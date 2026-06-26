# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VonKonig ERP — a full-stack POS/ERP system for a business in Argentina. Features include inventory management, sales, invoicing (including ARCA/AFIP fiscal integration), client accounts (cuentas corrientes), deliveries, purchases, and a public storefront.

## Monorepo Structure

- `backend/` — Express 5 + TypeScript + Prisma + PostgreSQL API (port 4000)
- `frontend/` — Next.js 16 + React 19 + TypeScript app (port 3000)

## Commands

### Backend

```bash
cd backend
npm run dev          # ts-node with nodemon
npm run build        # tsc
npm start            # node dist/index.js (production)
npm run seed         # seed database
npm run reset        # reset database
npm run worker       # start AFIP retry worker (separate process)
npx prisma studio    # open Prisma Studio
npx prisma migrate dev --name <name>   # create migration
npx prisma generate  # regenerate client after schema changes
```

### Frontend

```bash
cd frontend
npm run dev          # Next.js dev server
npm run build        # production build
npm run lint         # eslint
```

## Architecture

### Backend

- **Entry**: `src/index.ts` → `src/app.ts` (Express app with all routes)
- **Pattern**: `routes/` → `controllers/` → `services/` (no shared base classes)
- **Auth**: JWT stored in HTTP-only cookie (`token`). `authMiddleware` + `requireRole`/`requireAnyRole` guards on routes. Roles: `ADMIN`, `EMPLEADO`, `CLIENTE`.
- **Database**: Prisma ORM with PostgreSQL. Client singleton at `src/prisma.ts`. All models in `prisma/schema.prisma`.
- **AFIP/ARCA integration**: The Argentine fiscal system integration lives in `src/afip/`. Uses SOAP (xml2js) to call WSAA (auth) and WSFE (invoicing). Tokens are encrypted and stored in the DB (`AfipToken` model). The `src/worker.ts` process runs a retry loop for failed pending invoices. Active config module is `src/services/arcaConfig.service.ts` — the legacy one at `src/afip/_legacy-disabled/` is disabled.
- **PDF generation**: PDFs are generated with `pdfkit` and uploaded to Cloudinary. See `src/utils/pdfGenerator.ts` and `src/afip/utils/generarFacturaAfipPDF.ts`.
- **CORS**: Controlled in `app.ts`. Allowed origins include `localhost:3000-3002`, `localhost:4000`, and production domains. `FRONTEND_URL`, `STOREFRONT_URL`, `ADMIN_FRONTEND_URL`, `CORS_ORIGINS` env vars extend the list.

### Frontend

- **Entry**: `app/layout.tsx` → pages under `app/`
- **API client**: `lib/api.ts` — axios instance pointing to `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:5000`). Auto-redirects to `/login` on 401.
- **Auth state**: Zustand store at `store/auth.ts` (`useAuthStore`). `AppLayout` component checks auth on mount and redirects unauthenticated users to `/login`.
- **Layout**: All protected pages use `<AppLayout>` which renders the sidebar + topbar shell.
- **Routing**: Next.js App Router. Pages under `app/tienda/` are the public storefront with its own layout (`app/tienda/layout.tsx`). Everything else is the admin/employee ERP.
- **State**: Zustand for auth; no global state library for other data — each page fetches directly via `api`.
- **Types**: Shared domain types are in `frontend/types/index.ts`. Do not duplicate them.

## Key Environment Variables

### Backend
```
DATABASE_URL
JWT_SECRET
ARCA_CREDENTIALS_SECRET   # min 32 chars, encrypts AFIP tokens
CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)
FRONTEND_URL
```

### Frontend
```
NEXT_PUBLIC_API_URL   # backend URL (default: http://localhost:5000)
```

## AFIP/ARCA Notes

- `ArcaConfig` model stores per-business fiscal config, certificates, and points of sale.
- WSAA tokens are encrypted at rest using `ARCA_CREDENTIALS_SECRET` (via `src/services/arcaCrypto.service.ts`).
- Invoice types: A (wsfe-A), B (wsfe-B), C (wsfe-C), each with their own service file.
- Routes: `/arca-config` and `/afip/configuracion` are aliases for the same router.
- The AFIP retry worker (`src/worker.ts`) must run as a separate process in production.

## Frontend-Specific Notes

The `frontend/CLAUDE.md` (which references `AGENTS.md`) warns: **this Next.js version (16.x) has breaking changes from prior versions**. Check `node_modules/next/dist/docs/` before writing Next.js-specific code. The app uses the App Router with React 19.

Inline `<style jsx>` (styled-jsx) is used for page-scoped CSS alongside Tailwind utility classes. CSS variables for theming are defined in `app/globals.css`.
