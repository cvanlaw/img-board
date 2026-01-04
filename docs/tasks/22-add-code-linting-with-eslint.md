---
id: 22
title: Add Code Linting with ESLint
depends_on: [21]
status: pending
---

# Task 22: Add Code Linting with ESLint

## Description

Add ESLint as the code linter for the project using the new ESLint 9 flat config format. ESLint catches bugs, enforces best practices, and maintains code quality. This task integrates linting with Prettier (from Task 21) to avoid conflicts, adds npm scripts, updates CI workflow, and modifies the `/next-task` command to require passing lint/format checks.

## Deliverables

- `eslint.config.js` - ESLint flat config file
- `package.json` - Updated with lint scripts
- `.github/workflows/ci.yml` - Updated with lint and format jobs
- `.claude/commands/next-task.md` - Updated to require lint/format checks

## Acceptance Criteria

- [ ] ESLint 9 installed with `@eslint/js` and `eslint-config-prettier` as dev dependencies
- [ ] `eslint.config.js` uses flat config format with recommended rules
- [ ] `eslint-config-prettier` included last in config to disable conflicting rules
- [ ] `npm run lint:check` runs ESLint (exits non-zero on errors)
- [ ] `npm run lint:fix` runs ESLint with --fix flag
- [ ] CI workflow includes lint and format check jobs
- [ ] `/next-task` command updated to run lint:check and format:check before task completion (Step 9)
- [ ] All existing JS files pass lint check (fix any issues found)

## Implementation Details

### Install ESLint

```bash
npm install --save-dev eslint @eslint/js eslint-config-prettier globals
```

### eslint.config.js

```javascript
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['node_modules/', 'coverage/'],
  },
];
```

Note: If using CommonJS (require/module.exports), set `sourceType: 'commonjs'` instead.

### package.json scripts

```json
{
  "scripts": {
    "lint:check": "eslint .",
    "lint:fix": "eslint --fix ."
  }
}
```

### CI Workflow Update (.github/workflows/ci.yml)

Add new jobs before the test jobs:

```yaml
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint:check

  format:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run format:check
```

### Update /next-task Command

In `.claude/commands/next-task.md`, update Step 6 to add lint/format todos:

```javascript
TodoWrite({
  todos: [
    // ... acceptance criteria todos ...
    // 🔔 MANDATORY CLEANUP TODOS - ALWAYS INCLUDE:
    { content: "Run npm run format:check - all files must be formatted", status: "pending", activeForm: "Checking formatting" },
    { content: "Run npm run lint:check - no lint errors", status: "pending", activeForm: "Running linter" },
    { content: "Run npm run test:unit - all tests must pass", status: "pending", activeForm: "Running unit tests" },
    { content: "Run npm run test:integration - all tests must pass", status: "pending", activeForm: "Running integration tests" },
    { content: "Remove completed task file from docs/tasks/", status: "pending", activeForm: "Removing task file" },
    { content: "Commit all changes using /ai-commit", status: "pending", activeForm: "Committing changes" }
  ]
})
```

Also update Step 9.1 verification to include:
- Run `npm run format:check` - all files must be properly formatted (blocking)
- Run `npm run lint:check` - no lint errors (blocking)

## Testing Checklist

- [ ] Run `npm run lint:check` - should pass with no errors
- [ ] Run `npm run lint:fix` - should complete successfully
- [ ] Run `npm run format:check` - should still pass after lint fixes
- [ ] Push to GitHub and verify CI jobs pass
- [ ] Verify `/next-task` includes lint/format in todo list
