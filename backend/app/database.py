import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Add it to your .env file, e.g.: DATABASE_URL=postgresql+asyncpg://user@localhost/dbname"
    )

# Normalise scheme — asyncpg requires postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

_is_azure = "azure.com" in DATABASE_URL
_connect_args: dict = {}

if _is_azure:
    _connect_args["ssl"] = "require"

    # If no password is in the URL, use Azure Managed Identity to fetch a token.
    # This allows the App Service to connect to Azure PostgreSQL without storing
    # a password — the platform identity is used instead.
    _no_password = ":@" in DATABASE_URL or DATABASE_URL.endswith("@")
    if _no_password or not os.getenv("PGPASSWORD"):
        try:
            from azure.identity import DefaultAzureCredential

            _credential = DefaultAzureCredential()
            _token = _credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
            _connect_args["password"] = _token.token
        except Exception as e:
            logger.warning("Azure Managed Identity token fetch failed, falling back to password auth: %s", e)

engine = create_async_engine(DATABASE_URL, echo=False, future=True, connect_args=_connect_args)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


_MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


async def create_tables() -> None:
    """Create all tables and run pending migrations on startup."""
    async with engine.begin() as conn:
        from . import models  # noqa: F401 — ensure models are registered
        await conn.run_sync(Base.metadata.create_all)
    await _run_migrations()


async def _run_migrations() -> None:
    """Run any pending SQL migration files from backend/migrations/ in order.

    Each .sql file is a single SQL statement (or a PL/pgSQL DO block). Applied
    migrations are recorded in the schema_migrations table so they are never
    re-executed on subsequent startups.
    """
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id         TEXT        PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))

    if not _MIGRATIONS_DIR.exists():
        return

    sql_files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    for sql_file in sql_files:
        migration_id = sql_file.name
        async with engine.begin() as conn:
            row = await conn.execute(
                text("SELECT 1 FROM schema_migrations WHERE id = :id"),
                {"id": migration_id},
            )
            if row.scalar():
                continue

            logger.info("Applying migration: %s", migration_id)
            await conn.execute(text(sql_file.read_text()))
            await conn.execute(
                text("INSERT INTO schema_migrations (id) VALUES (:id)"),
                {"id": migration_id},
            )
            logger.info("Applied migration: %s", migration_id)
