import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 项目页：https://<user>.github.io/TheSims/
  base: '/TheSims/',
  // 产物放进 docs/，便于 Pages「Deploy from a branch → /docs」
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
