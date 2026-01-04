# EventSource Import Syntax Issue

**Date:** 2026-01-04
**Severity:** Low
**Status:** Open

## Summary

The `eventsource` package v4.x has a different export structure than expected, causing `TypeError: EventSource is not a constructor` in SSE integration tests.

## Error Details

```
TypeError: EventSource is not a constructor

    at Object.<anonymous> (tests/integration/sse.test.js:34:19)
```

## Affected Files

- `tests/integration/sse.test.js`

## Current Code

```javascript
const EventSource = require('eventsource');
```

## Fix

Update the import to match eventsource v4.x export structure:

```javascript
const { EventSource } = require('eventsource');
```

Or use default export syntax if available.

## Impact Assessment

- Affects 2 SSE integration tests
- Does not affect production code
- SSE functionality works correctly in production
