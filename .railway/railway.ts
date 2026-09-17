/**
 * Railway Infrastructure as Code for the services/api stack.
 *
 * This is deliberately NOT a railway.json / railway.toml. Railway's docs
 * mark Config as Code deprecated with a hard cutoff of 2026-12-01, and new
 * services can no longer opt into it at all -- see
 * https://docs.railway.com/config-as-code. `.railway/railway.ts` is the
 * current path.
 *
 * Four resources: managed Postgres, managed Redis, the FastAPI service and
 * the Celery worker. The same shape is what the marketplace template should
 * be composed from -- see docs/RAILWAY_TEMPLATE.md.
 */
import { defineRailway, github, group, postgres, project, redis, service } from "railway/iac";

const REPO = "beezelbutt94/Debate-UI-Gemini";

export default defineRailway((ctx) => {
  const db = postgres("postgres");
  const cache = redis("redis");

  const api = service("api", {
    source: github(REPO),
    // Railway only auto-detects a file literally named `Dockerfile`. This
    // repo ships Dockerfile.api / Dockerfile.worker / Dockerfile.web, so
    // each service has to name its own. RAILWAY_DOCKERFILE_PATH is read at
    // build time (https://docs.railway.com/builds/dockerfiles).
    // Set on the service build settings too, not only here. A missing
    // Dockerfile path does not fail the build -- Railpack finds package.json,
    // decides the repo is a Node project, and builds the Next.js app instead.
    // That is what happened on this stack's first deploy, before the variable
    // existed. Two places to clear means no window where it regresses quietly.
    env: {
      RAILWAY_DOCKERFILE_PATH: "Dockerfile.api",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
    },
    // /healthz is a plain {"status": "ok"} with no database call, so it
    // answers as soon as uvicorn is up. The schema bootstrap in
    // Dockerfile.api's start command runs before uvicorn, so if the
    // database is unreachable the container exits rather than passing a
    // health check it has no business passing.
    healthcheck: "/healthz",
    healthcheckTimeout: 60,
    replicas: ctx.environment === "production" ? 2 : 1,
  });

  const worker = service("worker", {
    source: github(REPO),
    env: {
      RAILWAY_DOCKERFILE_PATH: "Dockerfile.worker",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      // Build arg, consumed by `ARG INSTALL_ML_EXTRAS` in Dockerfile.worker.
      // Leave false unless the storyboard/subtitle/CLIP pipeline steps are
      // actually wanted -- true pulls torch and friends, several GB.
      INSTALL_ML_EXTRAS: "false",
    },
    // No healthcheck and no public networking: a Celery worker serves no
    // HTTP, so a health check would fail it forever and a public domain
    // would expose nothing.
  });

  return project("viralengine-api", {
    resources: [group("Backend", [db, cache, api, worker])],
  });
});
