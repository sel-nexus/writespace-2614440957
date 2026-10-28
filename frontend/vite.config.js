import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Configure the development server from public environment settings. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { host: env.VITE_DEV_HOST || '0.0.0.0', port: Number(env.VITE_DEV_PORT || 5173), strictPort: true },
  };
});
