import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Normalise scheme — asyncpg requires postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Azure PostgreSQL requires SSL; pass via connect_args so it works with asyncpg
_connect_args: dict = {}
if "azure.com" in DATABASE_URL:
    _connect_args["ssl"] = "require"

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


async def create_tables() -> None:
    """Create all tables if they do not exist (used on startup)."""
    async with engine.begin() as conn:
        from . import models  # noqa: F401 — ensure models are registered
        await conn.run_sync(Base.metadata.create_all)
