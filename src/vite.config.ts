import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is crucial for GitHub Pages. It ensures assets are loaded 
  // relatively (e.g., "./assets/..." instead of "/assets/...")
  // so it works in subdirectories like https://user.github.io/repo-name/
  base: './', 
  build: {
    outDir: 'dist',
  },
});
