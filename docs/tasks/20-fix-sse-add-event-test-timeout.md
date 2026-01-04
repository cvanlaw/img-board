---
id: 20
title: Fix SSE Add Event Test Timeout
depends_on: []
status: pending
---

# Task 20: Fix SSE Add Event Test Timeout

## Description

Increase the test timeout for the SSE add event integration test from 15 seconds to 30 seconds. The current timeout is insufficient due to Docker volume mount propagation delays and Chokidar's 1-second polling interval with `awaitWriteFinish` enabled.

## Deliverables

- `tests/integration/sse.test.js` - Updated test timeout

## Acceptance Criteria

- [ ] Test timeout increased from 15000ms to 30000ms
- [ ] SSE add event test passes reliably
- [ ] All SSE integration tests complete successfully

## Implementation Details

### Timeout Change

Change from:
```javascript
test('SSE receives add event when image added', (done) => {
  // ... test body
}, 15000);
```

To:
```javascript
test('SSE receives add event when image added', (done) => {
  // ... test body
}, 30000);
```

## Testing Checklist

- [ ] Run `npm run test:integration` and verify SSE tests pass
- [ ] Run SSE tests multiple times to confirm reliability
- [ ] Confirm no timeout errors in test output
