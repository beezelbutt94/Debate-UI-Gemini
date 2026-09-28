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
    logger.info("Initializing Viral Trending platform service runtime...")

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
        # Not a warning. This runs as an init container ahead of serving
        # traffic precisely so a schema problem stops the rollout; letting
        # it through means every request that touches a missing table 500s
        # at runtime instead, with the real cause buried in startup logs
        # nobody is looking at any more.
        logger.critical("Schema synchronization failed, refusing to start: %s", exc)
        sys.exit(1)

    logger.info("System initialization complete. Ready for requests.")


if __name__ == "__main__":
    initialize_runtime()
