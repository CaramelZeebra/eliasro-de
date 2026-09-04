// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://eliasro.de',
  // React exists solely for /connect4, which is a preserved artifact of the
  // previous site. Every other route ships zero framework JavaScript.
  integrations: [react()],
});
