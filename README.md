# Cernan

Static Astro site for the Cernan engineering agency. Use Node.js 22.23.4 or later.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Build from the repository root with Node.js 24 and `npm run build`. Publish `dist/` on Vercel, Netlify, Cloudflare Pages, or any static host. The canonical URL and social preview default to `https://www.cernan.co`. Set `SITE_URL` to override the public origin.

The homepage lives in `src/pages/index.astro`. The canvas scripts run as classic scripts in dependency order at the end of the page. `output/` and `versions/` hold design history outside the build.
