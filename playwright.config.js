// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    reducedMotion: 'reduce',
    trace: 'off',
  },
  webServer: {
    command: `node tests/server.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // iPhone uses Safari's engine (WebKit); Android uses Chrome's engine.
    { name: 'iPhone (Safari)', use: { ...devices['iPhone 13'] } },
    { name: 'Android (Chrome)', use: { ...devices['Pixel 7'] } },
  ],
});
