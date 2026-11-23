import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  scopedStyleStrategy: 'where',
  build: { inlineStylesheets: 'always' },
});
