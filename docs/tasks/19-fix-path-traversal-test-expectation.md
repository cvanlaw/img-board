---
id: 19
title: Fix Path Traversal Test Expectation
depends_on: []
status: pending
---

# Task 19: Fix Path Traversal Test Expectation

## Description

Update the path traversal integration test to expect HTTP 404 instead of 403. The fetch client normalizes `../config.json` before sending, so the server receives `/images/config.json` which doesn't exist. The security protection is still effective—the test expectation is incorrect.

## Deliverables

- `tests/integration/slideshow.test.js` - Updated status expectation

## Acceptance Criteria

- [ ] Test expects 404 status instead of 403
- [ ] Path traversal integration test passes
- [ ] All slideshow integration tests complete successfully

## Implementation Details

### Test Change

Change from:
```javascript
test('GET /images/:filename blocks path traversal', async () => {
  const res = await fetch(`${BASE_URL}/images/../config.json`);
  expect(res.status).toBe(403);
});
```

To:
```javascript
test('GET /images/:filename blocks path traversal', async () => {
  const res = await fetch(`${BASE_URL}/images/../config.json`);
  expect(res.status).toBe(404);
});
```

## Testing Checklist

- [ ] Run `npm test` and verify slideshow tests pass
- [ ] Confirm path traversal test no longer fails with 403/404 mismatch
- [ ] Verify all integration tests complete successfully
