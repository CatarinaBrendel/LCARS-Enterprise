/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setupTests.js"],
  globalSetup: '<rootDir>/__tests__/globalSetup.js',    
  globalTeardown: '<rootDir>/__tests__/globalTeardown.js',
  transform: {},                // no Babel/TS transforms needed
  testTimeout: 30000,
  moduleNameMapper: { '^node-cron$': '<rootDir>/__tests__/__mocks__/node-cron.js' },
}
