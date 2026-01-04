---
id: 20
title: Unit Tests
depends_on: [18, 19]
status: pending
---

# Task 20: Unit Tests

## Description

Create unit tests for pure utility functions (shuffleArray, deepMerge, ipMatches). Extract these functions from server.js into a dedicated lib/utils.js module to enable isolated testing.

## Deliverables

- `lib/utils.js` - Extracted utility functions
- `tests/unit/shuffle.test.js` - shuffleArray tests
- `tests/unit/deepMerge.test.js` - deepMerge tests
- `tests/unit/ipMatches.test.js` - ipMatches tests
- `server.js` - Updated to import from lib/utils.js

## Acceptance Criteria

- [ ] shuffleArray, deepMerge, ipMatches extracted to lib/utils.js
- [ ] server.js imports and uses functions from lib/utils.js
- [ ] shuffle.test.js covers: same elements, no mutation, empty array, single element
- [ ] deepMerge.test.js covers: top-level merge, nested merge, array replacement, no mutation
- [ ] ipMatches.test.js covers: localhost, IPv6-mapped, exact match, /24 subnet, rejection
- [ ] `npm run test:unit` passes all tests

## Implementation Details

### lib/utils.js

```javascript
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function ipMatches(clientIP, pattern) {
  const ip = clientIP.replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1' || clientIP === '::1') {
    return true;
  }
  if (ip === pattern) {
    return true;
  }
  if (pattern.endsWith('/24')) {
    const subnet = pattern.replace('/24', '').split('.').slice(0, 3).join('.');
    const ipPrefix = ip.split('.').slice(0, 3).join('.');
    return subnet === ipPrefix;
  }
  return false;
}

module.exports = { shuffleArray, deepMerge, ipMatches };
```

### tests/unit/shuffle.test.js

```javascript
const { shuffleArray } = require('../../lib/utils');

describe('shuffleArray', () => {
  test('returns array with same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result).toHaveLength(input.length);
    expect(result.sort()).toEqual(input.sort());
  });

  test('does not modify original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  test('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  test('handles single element', () => {
    expect(shuffleArray([1])).toEqual([1]);
  });
});
```

### tests/unit/deepMerge.test.js

```javascript
const { deepMerge } = require('../../lib/utils');

describe('deepMerge', () => {
  test('merges top-level properties', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('merges nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };
    expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3 } });
  });

  test('replaces arrays instead of merging', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
  });

  test('does not modify original objects', () => {
    const target = { nested: { a: 1 } };
    const source = { nested: { b: 2 } };
    deepMerge(target, source);
    expect(target).toEqual({ nested: { a: 1 } });
    expect(source).toEqual({ nested: { b: 2 } });
  });
});
```

### tests/unit/ipMatches.test.js

```javascript
const { ipMatches } = require('../../lib/utils');

describe('ipMatches', () => {
  test('allows localhost IPv4', () => {
    expect(ipMatches('127.0.0.1', '192.168.1.0/24')).toBe(true);
  });

  test('allows localhost IPv6', () => {
    expect(ipMatches('::1', '192.168.1.0/24')).toBe(true);
  });

  test('strips IPv6-mapped IPv4 prefix', () => {
    expect(ipMatches('::ffff:192.168.1.50', '192.168.1.50')).toBe(true);
  });

  test('matches exact IP', () => {
    expect(ipMatches('192.168.1.100', '192.168.1.100')).toBe(true);
    expect(ipMatches('192.168.1.100', '192.168.1.101')).toBe(false);
  });

  test('matches /24 subnet', () => {
    expect(ipMatches('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.1.255', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.2.50', '192.168.1.0/24')).toBe(false);
  });

  test('rejects non-matching IP', () => {
    expect(ipMatches('10.0.0.5', '192.168.1.100')).toBe(false);
  });
});
```

## Testing Checklist

- [ ] `npm run test:unit` passes all tests
- [ ] Server still functions correctly after refactoring
- [ ] All 4 shuffle tests pass
- [ ] All 4 deepMerge tests pass
- [ ] All 6 ipMatches tests pass
