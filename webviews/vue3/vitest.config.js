/// <reference types="vitest" />

import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [Vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    // If we use a multi-thread test runner, the threads start hanging.
    // I wasn't able to fix the issue in two hours I looked at it, and so this is a good-enough workaround.
    // Right now the tests suite runs in 1s, if the time starts being a problem, we will have to fix the
    // thread hanging.
    threads: false,
  },
});
