# Website Scanner Architecture

## Stack

- Next.js App Router, React, TypeScript, and Tailwind for the hosted app.
- PostgreSQL with Prisma for clients, projects, scans, URLs, findings, and reports.
- Redis and BullMQ for background scan jobs.
- Playwright plus axe-core for browser-based accessibility checks.
- WAVE API and PageSpeed Insights API as external scan providers.

## Data Flow

1. A developer or client submits one URL or a batch of URLs.
2. The app creates a `Scan` and child `ScannedUrl` records in Postgres.
3. The scan is queued in Redis for the worker.
4. Worker adapters collect ADA, speed, SEO, technical, security, and CMS findings.
5. Raw provider output is stored in `ScannedUrl.rawMetrics` or `Finding.evidence`.
6. Normalized findings power both web developer and client-facing reports.

## Report Order

1. Needed Website Updates
2. ADA Report
3. Speed Report
4. SEO Report
5. Other Issues

The client report should explain why each category matters. The developer view should keep raw details, evidence, source tools, and remediation notes.
