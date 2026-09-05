# Pending production migration: `20260904120000_add_providers`

## Status: REQUIRES MANUAL ACTION BEFORE THE NEXT DEPLOY

The migration at `backend/prisma/migrations/20260904120000_add_providers` was
committed to this repository but was **never applied to the production
Postgres database**. Because of this mismatch between the Prisma schema and
the live database, `GET /providers` currently fails with:

```
PrismaClientKnownRequestError P2021: table "public.Provider" does not exist
```

## What the migration does

It is purely additive and carries **no data-loss risk**:

- Creates a new `Provider` table (`razonSocial`, `nombreFantasia`, `cuit`,
  `telefono`, `email`, `direccion`, `contactoNombre`, `notas`, `isActive`,
  timestamps).
- Adds indexes on `Provider.isActive` and `Provider.cuit`.
- Adds a new **nullable** `providerId` column to the existing `Purchase`
  table, with an index and a `SET NULL` foreign key to `Provider`.

No existing columns are altered or dropped, so it is safe to run against the
live database at any time.

## How to apply it (one-time, manual step)

Run this once, in an environment where `DATABASE_URL` is already set to the
production database:

```bash
npx prisma migrate deploy
```

Or, using the helper script included in this repo (`backend/run-migration.js`,
also wired up as an npm script):

```bash
npm run migrate:prod
```

Both approaches call `prisma migrate deploy` under the hood, which applies
all pending migrations in `prisma/migrations/` and is safe to re-run (it is a
no-op if there is nothing pending).

### Running it in the production container (Railway)

If the backend is deployed as a container/service with `DATABASE_URL` already
configured in its environment, run the command as a one-off:

```bash
railway run --service <backend-service> npm run migrate:prod
```

or, if you have a shell in the running container:

```bash
node run-migration.js
```

The script exits with code `0` on success and a non-zero code on failure, and
prints the full `prisma migrate deploy` output to stdout/stderr.

## After applying

Once the migration has been applied, `GET /providers` should work as
expected, and this note can be removed/updated for future migrations.
