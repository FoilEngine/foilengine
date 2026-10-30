import { defineConfig } from 'vitest/config';

// Benchmarks run on native Node ESM: Vite's module runner turns every import into a getter,
// whose cost would dominate the measurement of the engine (vitest.dev/guide/benchmarking).
export default defineConfig({
  test: {
    experimental: { viteModuleRunner: false },
  },
});
