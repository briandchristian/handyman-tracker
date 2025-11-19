module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  maxWorkers: 2, // Limit parallel test execution to prevent resource exhaustion
  // Note: forceExit is a workaround for hanging tests. Ideally, proper cleanup should be
  // implemented in tests and this should be removed to catch resource leaks.
  // When forceExit is true, detectOpenHandles should be enabled to still catch leaks.
  forceExit: true, // Force exit after tests complete to prevent hanging
  detectOpenHandles: true, // Enable to detect resource leaks even with forceExit
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '^@/config/api$': '<rootDir>/src/config/__mocks__/api.js',
    '^../config/api$': '<rootDir>/src/config/__mocks__/api.js',
    '^../../config/api$': '<rootDir>/src/config/__mocks__/api.js',
  },
  transform: {
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', { rootMode: 'upward' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|mongodb-memory-server|bson|@mongodb-js)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    'api/**/*.js',
    '!src/main.jsx',
    '!src/index.css',
    '!src/App.css',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    // Temporarily ignore these tests until they're fixed
    // 'api/__tests__/server-utils.test.js',
    // 'api/__tests__/auth-routes.test.js',
    // 'api/__tests__/customer-routes.test.js',
  ],
};

