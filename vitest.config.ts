import { defineConfig } from 'vitest/config';

// Tests of the repository tooling (scripts/). Each workspace package runs its own tests.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
  },
});
