# SSE Add Event Test Timeout

**Date:** 2026-01-04
**Severity:** Low
**Status:** Open

## Summary

The SSE integration test "SSE receives add event when image added" times out after 15 seconds waiting for an `add` event that never arrives, despite the file being correctly added to the processed directory.

## Error Details

```
thrown: "Exceeded timeout of 15000 ms for a test while waiting for `done()` to be called.
Add a timeout value to this test to increase the timeout, if this is a long-running test."

    at test (tests/integration/sse.test.js:39:3)
```

## Affected Files

- `tests/integration/sse.test.js`

## Root Cause Analysis

The test adds a file to the host's `test-data/processed/` directory which is mounted into the Docker container. Several factors contribute to the timeout:

### 1. Docker Volume Mount Propagation
Files written on the host may not immediately appear in the container due to volume mount propagation delays.

### 2. Chokidar Polling Configuration
```javascript
const watcher = chokidar.watch(config.imagePath, {
  usePolling: true,
  interval: 1000,        // 1 second polling interval
  awaitWriteFinish: true // Additional delay waiting for write completion
});
```

The `usePolling: true` is required for NFS/CIFS compatibility, but introduces up to 1 second delay per poll cycle. Combined with `awaitWriteFinish`, this can extend detection time.

### 3. Test Timing Race Condition
The test structure:
```javascript
eventSource.addEventListener('connected', async () => {
  await addProcessedImage('sse-test.webp');  // File added here
});

eventSource.addEventListener('add', (event) => {
  // Waiting for this event
  done();
});
```

There's no guarantee the file system event will be detected and broadcast within the test timeout.

## Fix Options

1. **Increase test timeout**: Extend from 15s to 30s or more
   ```javascript
   }, 30000);
   ```

2. **Add polling retry in test**: Poll for the file to appear before expecting the event
   ```javascript
   eventSource.addEventListener('connected', async () => {
     await addProcessedImage('sse-test.webp');
     // Wait for file to be visible in container
     await waitForFileInContainer('sse-test.webp');
   });
   ```

3. **Reduce Chokidar polling interval in test config**: Use faster polling for tests
   ```javascript
   interval: 100  // 100ms for tests
   ```

4. **Skip this specific test**: Mark as known flaky with `test.skip`
   ```javascript
   test.skip('SSE receives add event when image added', ...
   ```

5. **Use touch inside container**: Instead of adding file on host, exec into container
   ```javascript
   execSync('docker exec slideshow-test touch /mnt/photos/processed/test.webp');
   ```

## Recommended Fix

Option 3 (faster polling for tests) combined with option 1 (increased timeout) provides the most reliable solution without fundamentally changing the test architecture.

Create a test-specific config with:
```json
{
  "chokidar": {
    "interval": 100
  }
}
```

Or pass environment variable to reduce polling interval in test mode.

## Impact Assessment

- Affects 1 integration test
- Does not affect production code
- SSE functionality works correctly in production
- First SSE test (connection) passes reliably
