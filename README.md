# Website Scanner App

Hosted webdev audit app for scanning client websites and producing ADA, speed,
SEO, needed-update, and technical issue reports.

## Stack

- Next.js App Router, React, TypeScript, Tailwind
- PostgreSQL and Prisma
- Redis and BullMQ for scan workers
- Playwright, axe-core, WAVE API, and PageSpeed/Lighthouse scan adapters

## Local Setup

This machine is using Homebrew Postgres on `localhost:5432`.

```bash
npm install
brew services start postgresql@16
npm run db:migrate -- --name init
npm run dev
```

Redis is optional until the worker is fully wired. Leave `REDIS_URL` blank to
save scan records without queueing worker jobs.

Run the scan worker in a second terminal:

```bash
npm run scan:worker
```

## Environment

Copy `.env.example` to `.env` and add API keys when ready:

- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `WAVE_API_KEY`
- `PAGESPEED_API_KEY`

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run db:migrate
npm run db:studio
npm run scan:worker
```

See `docs/architecture.md` for the scan/report structure.
