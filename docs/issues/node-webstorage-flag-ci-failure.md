# Node.js --no-webstorage Flag CI Failure

## Issue

Both Unit Tests and Integration Tests jobs fail in GitHub Actions with exit code 9.

**Workflow Run:** https://github.com/cvanlaw/img-board/actions/runs/20697373603

## Error

```
node: bad option: --no-webstorage
```

## Root Cause

The test scripts in `package.json` use the `--no-webstorage` Node.js flag:

```json
"test:unit": "node --no-webstorage ./node_modules/.bin/jest --testPathPatterns=tests/unit --passWithNoTests",
"test:integration": "node --no-webstorage ./node_modules/.bin/jest --testPathPatterns=tests/integration --runInBand --passWithNoTests"
```

This flag was introduced with the Web Storage API feature:
- **Node 22**: `--experimental-webstorage` flag added
- **Node 25**: Web Storage enabled by default, `--no-webstorage` available to disable it

CI uses Node.js 20 (`.github/workflows/ci.yml` line 17), which predates this flag.

## Solutions

### Option A: Upgrade CI Node version to 22+

Update `.github/workflows/ci.yml`:
```yaml
node-version: '22'
```

Pros: Uses newer Node.js features
Cons: May introduce other compatibility issues; must ensure Docker also uses Node 22+

### Option B: Remove --no-webstorage flag from test scripts

The flag was likely added proactively for Node 25+ compatibility. For Node 20/22, it's unnecessary.

Update `package.json`:
```json
"test": "jest --passWithNoTests",
"test:unit": "jest --testPathPatterns=tests/unit --passWithNoTests",
"test:integration": "jest --testPathPatterns=tests/integration --runInBand --passWithNoTests"
```

Pros: Simpler, works across all Node versions
Cons: May need to add the flag back when upgrading to Node 25+

### Option C: Conditional flag based on Node version

Use a wrapper script or npm-run-all to detect Node version and apply flag conditionally.

Pros: Future-proof
Cons: Added complexity

## Recommendation

Option B is preferred. The `--no-webstorage` flag is only needed when Web Storage is enabled by default (Node 25+). Remove it now and add it back when upgrading to Node 25.

## References

- [Node.js v25.0.0 Release Notes](https://nodejs.org/en/blog/release/v25.0.0)
- [Vitest issue with Web Storage API](https://github.com/vitest-dev/vitest/issues/8757)
- [nodejs/node PR #57666 - Unflag webstorage](https://github.com/nodejs/node/pull/57666)
