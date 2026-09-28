"""Database engine and session helpers.

Modules call `db.session_scope()` (not a module-level SessionLocal import) so
tests can swap the engine with `configure_engine()` and every caller follows.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


class Base(DeclarativeBase):
    pass


engine: Engine
SessionLocal: sessionmaker[Session]


def configure_engine(url: str) -> Engine:
    global engine, SessionLocal
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    else:
        kwargs["pool_pre_ping"] = True
    engine = create_engine(url, **kwargs)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    return engine


configure_engine(settings.DATABASE_URL)


def init_db() -> None:
    from app import models  # noqa: F401  (register tables on Base.metadata)

    Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    with session_scope() as session:
        yield session
