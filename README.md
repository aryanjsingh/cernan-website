# Cernan

Static Astro site for the Cernan engineering agency. Use Node.js 22.23.4 or later.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Deploy from the repository root with `npm run build` and publish `dist/`. Select the Astro preset on Vercel or Netlify. On Cloudflare Pages, use the Astro preset and set the build output directory to `dist`. Use a supported Node.js version in the host's build settings. You can also upload the contents of `dist/` to any static host.

The homepage lives in `src/pages/index.astro`. The canvas scripts run as classic scripts in dependency order at the end of the page. `output/` and `versions/` hold design history outside the build.
