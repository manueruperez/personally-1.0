import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'libs',
      include: ['libs/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'api',
      include: ['apps/api/**/*.test.ts'],
      environment: 'node',
    },
  },
  './apps/frontend/vitest.config.ts',
]);
