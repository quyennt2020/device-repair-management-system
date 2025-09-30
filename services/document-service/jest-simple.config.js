module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/simple.test.js'],
  transform: {},
  moduleFileExtensions: ['js', 'ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/index.ts'
  ]
};