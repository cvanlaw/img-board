---
id: 21
title: Add Code Formatting with Prettier
depends_on: []
status: pending
---

# Task 21: Add Code Formatting with Prettier

## Description

Add Prettier as the code formatter for the project. Prettier enforces consistent code style across all JavaScript files, ensuring the codebase remains clean and readable. This task sets up Prettier with configuration and npm scripts that can run independently.

## Deliverables

- `.prettierrc.json` - Prettier configuration file
- `.prettierignore` - Files/directories to exclude from formatting
- `package.json` - Updated with format scripts

## Acceptance Criteria

- [ ] Prettier installed as dev dependency
- [ ] `.prettierrc.json` exists with sensible defaults (single quotes, no semicolons per project style, or adjust to match existing code)
- [ ] `.prettierignore` excludes node_modules, dist, coverage, and other generated files
- [ ] `npm run format:check` runs Prettier in check mode (exits non-zero if files need formatting)
- [ ] `npm run format:fix` runs Prettier and fixes all files in place
- [ ] All existing JS files pass format check (run format:fix if needed)

## Implementation Details

### Install Prettier

```bash
npm install --save-dev prettier
```

### .prettierrc.json

Review existing code style and configure accordingly. Example:

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### .prettierignore

```
node_modules/
coverage/
*.webp
*.png
*.jpg
*.jpeg
tests/fixtures/
```

### package.json scripts

```json
{
  "scripts": {
    "format:check": "prettier --check .",
    "format:fix": "prettier --write ."
  }
}
```

## Testing Checklist

- [ ] Run `npm run format:check` - should pass with no errors
- [ ] Run `npm run format:fix` - should complete successfully
- [ ] Verify formatted files maintain correct functionality
