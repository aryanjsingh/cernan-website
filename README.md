# Cernan

Static Astro site for the Cernan engineering agency. Use Node.js 22.23.4 or later.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Build from the repository root with Node.js 24 and `npm run build`. Publish `dist/` on Vercel, Netlify, Cloudflare Pages, or any static host.

Set `SITE_URL` to the verified public origin (for example, `https://example.com`) in the build environment to emit the canonical link and `og:url`. Builds without `SITE_URL` omit both tags.

The homepage lives in `src/pages/index.astro`. The canvas scripts run as classic scripts in dependency order at the end of the page. `output/` and `versions/` hold design history outside the build.
