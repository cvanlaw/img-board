const path = require('path');
const fs = require('fs').promises;

// Test directory constants
const TEST_DIR = path.join(__dirname, '.test-data');
const RAW_DIR = path.join(TEST_DIR, 'raw');
const PROCESSED_DIR = path.join(TEST_DIR, 'processed');
const ARCHIVE_DIR = path.join(TEST_DIR, 'archive');

// Set test environment
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

module.exports = { TEST_DIR, RAW_DIR, PROCESSED_DIR, ARCHIVE_DIR };
