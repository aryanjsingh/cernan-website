import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || undefined,
  scopedStyleStrategy: 'where',
  build: { inlineStylesheets: 'always' },
});
