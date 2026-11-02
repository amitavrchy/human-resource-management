#!/bin/bash
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
POSTGRES_USER="${POSTGRES_USER:-peopleos}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-peopleos}"
POSTGRES_DB="${POSTGRES_DB:-peopleos}"

for b in /usr/lib/postgresql/*/bin; do
  if [ -x "$b/pg_ctl" ]; then
    export PATH="$b:$PATH"
    break
  fi
done

if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  echo "[entrypoint] initializing PostgreSQL data directory"
  mkdir -p "${PGDATA}"
  chown -R postgres:postgres "${PGDATA}" /var/run/postgresql
  gosu postgres initdb -D "${PGDATA}" --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
fi

chown -R postgres:postgres "${PGDATA}" /var/run/postgresql

PG_OPTS="-c listen_addresses=127.0.0.1 -c port=5432 -c shared_buffers=32MB -c max_connections=20 -c work_mem=1MB -c maintenance_work_mem=16MB -c effective_cache_size=64MB -c wal_buffers=1MB -c min_wal_size=32MB -c max_wal_size=64MB -c checkpoint_completion_target=0.9 -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c logging_collector=off"

echo "[entrypoint] starting PostgreSQL (low-memory)"
gosu postgres pg_ctl -D "${PGDATA}" -o "${PG_OPTS}" -w start

echo "[entrypoint] ensuring role and database exist"
gosu postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
SQL

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?schema=public"
export ALLOW_DEMO_SEED="${ALLOW_DEMO_SEED:-true}"

if [ -z "${DEMO_PASSWORD:-}" ]; then
  echo "[entrypoint] ERROR: DEMO_PASSWORD must be set for demo seeding" >&2
  exit 1
fi

cd /app
echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] seeding demo data"
node prisma/seed.mjs

echo "[entrypoint] starting API on PORT=${PORT:-10000}"
exec node dist/main.js
