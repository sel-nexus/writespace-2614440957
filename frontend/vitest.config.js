import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], exclude: ['src/test/**', 'src/main.jsx'] },
  },
});
