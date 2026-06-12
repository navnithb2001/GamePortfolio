import { defineConfig } from 'vite';

export default defineConfig({
  base: '/GamePortfolio/',
  build: {
    target: 'es2020',
    sourcemap: false
  }
});
