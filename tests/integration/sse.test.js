const { EventSource } = require('eventsource');
const { execSync } = require('child_process');
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
} = require('./helpers');

describe('Server-Sent Events', () => {
  let eventSource;

  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  afterEach(() => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  });

  test('SSE connection receives connected event', (done) => {
    eventSource = new EventSource(`${BASE_URL}/api/events`);
    eventSource.addEventListener('connected', () => done());
    eventSource.onerror = () => done(new Error('SSE connection failed'));
  });

  test('SSE receives add event when image added', (done) => {
    eventSource = new EventSource(`${BASE_URL}/api/events`);

    eventSource.addEventListener('connected', () => {
      // Create file inside container to trigger Chokidar detection
      // Host-to-container volume writes don't reliably trigger polling
      execSync(
        'docker exec slideshow-test touch /mnt/photos/processed/sse-test.webp'
      );
    });

    eventSource.addEventListener('add', (event) => {
      const data = JSON.parse(event.data);
      expect(data.filename).toBe('sse-test.webp');
      done();
    });
  }, 30000);
});
