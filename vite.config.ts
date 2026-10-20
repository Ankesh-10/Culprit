import { defineConfig } from 'vite';
import { SECURITY_HEADERS } from './scripts/serve-dist.mjs';

export default defineConfig({
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  worker: { format: 'es' },
  // `npm run preview` sends the same security headers as the production static server.
  preview: { headers: { ...SECURITY_HEADERS } },
});
