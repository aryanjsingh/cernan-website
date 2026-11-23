import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://www.cernan.co',
  scopedStyleStrategy: 'where',
  build: { inlineStylesheets: 'always' },
});
