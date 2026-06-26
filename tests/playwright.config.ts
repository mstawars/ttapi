import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Trouble Ticket API automated tests.
 *
 * Global setup:
 *  global-setup.ts runs once before all tests and seeds fixture tickets
 *  (inProgress, resolved) directly into PostgreSQL via `docker exec`.
 *  This makes every test independent – no shared mutable state between tests.
 *
 * Projects:
 *  - api   : REST API black-box tests (no browser, uses Playwright request context)
 *  - e2e   : Full browser E2E tests against the React frontend
 *
 * Run order: api project executes first, then e2e.
 * Tests are independent – no shared mutable pre-seeded state.
 */
export default defineConfig({
  /* Discover test files relative to this config */
  testDir: '.',

  /* Global setup – seed fixture tickets before any test runs */
  globalSetup: './global-setup.ts',

  /* Sequential execution – tests share pre-seeded DB state */
  fullyParallel: false,
  workers: 1,

  /* Global timeout per test */
  timeout: 60_000,

  /* Fail the build on CI if there are any skipped tests */
  forbidOnly: !!process.env.CI,

  /* No automatic retries – state-changing tests must not run twice */
  retries: 0,

  /* Reporters: Allure (primary) + list (console) */
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: false,
      },
    ],
  ],

  projects: [
    /* ─────────────────────────────────────────
     * API tests – no browser required
     * ───────────────────────────────────────── */
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      use: {
        /* baseURL used when calling request.get/post with relative paths */
        baseURL: 'http://localhost:8080',
        extraHTTPHeaders: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    },

    /* ─────────────────────────────────────────
     * E2E tests – full browser journey
     * ───────────────────────────────────────── */
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
        /* Capture trace on first retry for debugging */
        trace: 'on-first-retry',
        /* Screenshot on failure */
        screenshot: 'only-on-failure',
        /* Video on failure */
        video: 'on-first-retry',
        /* Viewport */
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
