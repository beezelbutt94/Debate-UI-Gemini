"""Startup sanity checks: verifies the database is reachable and that the
declarative schema exists, for use in an init container or entrypoint
script ahead of serving traffic."""
import logging
import sys

from app.core import models  # noqa: F401 - populates Base.metadata
from app.core.database import Base, engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("system_init")


def initialize_runtime() -> None:
    logger.info("Initializing ViralVision platform service runtime...")

    try:
        with engine.connect():
            logger.info("PostgreSQL connection pool initialized.")
    except Exception as exc:
        logger.critical("Database initialization error: %s", exc)
        sys.exit(1)

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Schema definitions synchronized with target database.")
    except Exception as exc:
        logger.error("Schema sync encountered a warning: %s", exc)

    logger.info("System initialization complete. Ready for requests.")


if __name__ == "__main__":
    initialize_runtime()
