// Test setup file

// Mock the database connection
jest.mock('../types', () => ({
  ...jest.requireActual('../types'),
  getDbConnection: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3006';