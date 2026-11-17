import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// vite.config.ts 와 분리: 테스트 전용 설정 (Phase 2 컴포넌트 테스트 대비 jsdom + react 플러그인)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    globals: false,
  },
});
