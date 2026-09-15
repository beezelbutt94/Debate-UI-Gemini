# Migrations

No migration has been generated yet. Once a real PostgreSQL instance is
available, generate the initial migration from the consolidated models in
`app/core/models.py` with:

```bash
cd services/api
alembic revision --autogenerate -m "initial platform schema"
alembic upgrade head
```

Hand-writing this migration up front (as the original design docs did)
risks drifting from `models.py` the moment either one changes; letting
Alembic diff the live models against the database is the source of truth.
The design docs also describe a `b_roll_library` table with a `pgvector`
`Vector(512)` column and an HNSW index for CLIP similarity search
(`app/pipeline/clip_matcher.py`) — that table isn't in `models.py` yet
because it needs the `vector` Postgres extension enabled first
(`CREATE EXTENSION IF NOT EXISTS vector;`), which autogenerate won't do
for you.
