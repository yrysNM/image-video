# ImageToVideo

Next.js 14 app that turns a still image + motion prompt into a short AI video. Providers are swappable via env (`fal`, `runway`, `kling`, or `mock`). Generation history is stored in SQLite with Prisma; uploads go to `public/uploads` locally or an S3-compatible bucket in production.

## Requirements

- Node.js 18+
- npm 9+
- A video provider API key when not using mock mode

## Quick start (recommended: free fal.ai credits)

```bash
cd imagetovideo
cp .env.example .env
npm install
npx prisma db push
```

1. Create a free account at [https://fal.ai](https://fal.ai) and copy a key from [https://fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)
2. Put it in `.env`:

```env
VIDEO_API_PROVIDER=fal
VIDEO_API_KEY=your_fal_key
NEXT_PUBLIC_APP_URL=http://localhost:9090
```

3. Start the app:

```bash
npm run dev
```

Open [http://localhost:9090](http://localhost:9090) (or whatever port you use).

Local uploads are converted to data URIs, so providers do **not** need a public tunnel to reach your machine.

> **Note:** DaVinci Resolve is a free *video editor*, not an image-to-video AI API. For free AI generation this app uses **fal.ai Stable Video Diffusion**.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite URL, e.g. `file:./dev.db` |
| `VIDEO_API_PROVIDER` | No | `fal` (default), `runway`, `kling`, or `mock` |
| `VIDEO_API_KEY` | For fal/runway/kling | Provider API key (`FAL_KEY` also accepted for fal) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public app URL in prod; localhost is fine with fal/runway data-URI upload |
| `STORAGE_BUCKET_URL` | Prod optional | Public base URL for S3 objects |
| `S3_BUCKET` | Prod optional | Bucket name |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Prod optional | S3 credentials |
| `KLING_API_BASE_URL` | Kling optional | Defaults to `https://api.kie.ai` |

## Providers

### fal.ai Stable Video Diffusion (recommended free path)

Uses open-source **Stable Video Diffusion** hosted on fal.ai. New accounts sometimes get starter credits; after that you must add prepaid credits. A **403 Forbidden** response almost always means the account has **$0 balance** or the key is wrong — check [billing](https://fal.ai/dashboard/billing) and [keys](https://fal.ai/dashboard/keys).

```env
VIDEO_API_PROVIDER=fal
VIDEO_API_KEY=your_fal_key
```

SVD animates the image; duration chips map to motion strength. Quality is below Runway Gen-4.5 but it is real AI video. There is no unlimited free cloud I2V API anymore (Hugging Face free serverless no longer hosts these models).

### Mock

Set `VIDEO_API_PROVIDER=mock` for UI testing only (returns a sample flower MP4, not AI).

### Runway (paid)

Uses **gen4.5** via `@runwayml/sdk`.

```env
VIDEO_API_PROVIDER=runway
VIDEO_API_KEY=your_runway_key
```

### Kling (paid / third-party)

HTTP client for the Kie.ai Kling image-to-video job API:

```env
VIDEO_API_PROVIDER=kling
VIDEO_API_KEY=your_kling_key
```

## API routes

- `POST /api/generate` — multipart form: `image` (or `imageUrl` to reuse), `prompt`, optional `negativePrompt`, `duration`, `aspectRatio`. Returns `{ jobId }`.
- `GET /api/status/[jobId]` — poll job status for the current session.
- `GET /api/history` — list recent generations for the session cookie.

Sessions use an `httpOnly` `session_id` cookie (no login in v1).

## Production storage

When `S3_BUCKET` (and credentials) or `STORAGE_BUCKET_URL` is configured, uploads go to S3 instead of `public/uploads`.

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # run production server
npx prisma db push   # sync SQLite schema
npx prisma studio    # browse DB
```

## Out of scope (v1)

- User authentication
- Payments / credits
- Batch / multi-image generation
