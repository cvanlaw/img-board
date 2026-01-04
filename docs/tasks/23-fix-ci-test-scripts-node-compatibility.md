---
id: 23
title: Fix CI Test Scripts Node Compatibility
depends_on: []
status: pending
---

# Task 23: Fix CI Test Scripts Node Compatibility

## Description

Remove the `--no-webstorage` flag from npm test scripts in package.json. This flag was introduced in Node.js 22+ and does not exist in Node.js 20, which is used by GitHub Actions CI. The CI currently fails with "node: bad option: --no-webstorage" exit code 9.

## Deliverables

- `.github/workflows/ci.yml` - Updated to use Node 25
- `Dockerfile` - Updated to use node:25-alpine

## Acceptance Criteria

- [ ] CI workflow upgraded to Node 25 (supports `--no-webstorage` flag)
- [ ] Dockerfile upgraded to node:25-alpine
- [ ] CI workflow passes on GitHub Actions

## Implementation Details

### package.json Changes

Update the scripts section:

```json
"test": "jest --passWithNoTests",
"test:unit": "jest --testPathPatterns=tests/unit --passWithNoTests",
"test:integration": "jest --testPathPatterns=tests/integration --runInBand --passWithNoTests"
```

### Background

The `--no-webstorage` flag:
- Node 22: `--experimental-webstorage` introduced
- Node 25: Web Storage enabled by default, `--no-webstorage` available
- Node 20: Flag does not exist

When upgrading to Node 25+, this flag may need to be re-added to prevent Jest interference from the Web Storage API.

## Testing Checklist

- [ ] Run `npm run test:unit` locally
- [ ] Run `npm run test:integration` locally
- [ ] Push to main branch and verify CI passes
- [ ] Confirm all three test jobs complete successfully

## References

- Issue: docs/issues/node-webstorage-flag-ci-failure.md
- Workflow: https://github.com/cvanlaw/img-board/actions/runs/20697373603
