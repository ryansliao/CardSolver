"""Seed system: export/load reference data between the DB and backend/seed/*.yaml.

See `python -m app.seed --help` for CLI usage. Entities are stored one per YAML
file and cross-referenced by natural key (name / category / credit_name).
"""

from pathlib import Path

SEED_DIR: Path = Path(__file__).resolve().parent.parent.parent / "seed"
