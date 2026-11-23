# Cernan

Static Astro site for the Cernan engineering agency, with a zero-dependency serverless inquiry endpoint (`api/inquiry.mjs`). Use Node.js 22.23.4 or later.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Build from the repository root with Node.js 24 and `npm run build`. Publish `dist/` on Vercel (recommended so `api/inquiry.mjs` deploys automatically at `/api/inquiry`), Netlify, Cloudflare Pages, or any static host.

## Environment variables

See `.env.example`:

- `SITE_URL`: Verified public origin (for example, `https://cernan.co`) to emit canonical and `og:url` tags.
- `RESEND_API_KEY`: Resend API key for delivering `POST /api/inquiry` submissions to `admin@cernan.co`.
- `INQUIRY_WEBHOOK_URL`: Optional webhook relay, used only when `RESEND_API_KEY` is unset. If neither is set, the form offers a pre-filled `mailto:admin@cernan.co` link.
- `INQUIRY_TO`: Recipient address (defaults to `admin@cernan.co`).
- `INQUIRY_FROM`: Verified sender address in Resend (defaults to `Cernan Website <inquiries@cernan.co>`).

The homepage lives in `src/pages/index.astro`. The canvas scripts run as classic scripts in dependency order at the end of the page. `output/` and `versions/` hold design history outside the build.
