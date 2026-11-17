import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: 상대 경로 base + HashRouter 로 하위 경로/새로고침 404 회피
export default defineConfig({
  base: './',
  plugins: [react()],
});
