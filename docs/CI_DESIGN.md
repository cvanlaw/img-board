# CI/CD Design

GitHub Actions workflow for continuous integration.

## Triggers

Runs on:
- Push to `main` branch
- Pull request creation and sync against `main`

## Jobs

All jobs run in parallel on `ubuntu-latest`.

### 1. Unit Tests

Fast tests for pure functions (no Docker required).

```bash
npm run test:unit
```

Tests: `shuffleArray`, `deepMerge`, `ipMatches`

### 2. Integration Tests

API and SSE tests against containerized application.

```bash
npm run test:integration
```

- Builds Docker image
- Starts container with test config
- Runs HTTP/SSE assertions
- 10-minute timeout (container startup + test execution)

### 3. Docker Build

Verifies the production image builds successfully.

```bash
docker compose build
```

Catches:
- Dockerfile syntax errors
- Missing dependencies
- Sharp/Vips compilation issues on Alpine

## Workflow File

Located at `.github/workflows/ci.yml`

## Local Verification

Before pushing, run locally:

```bash
npm run test:unit           # Fast, no Docker
npm run test:integration    # Requires Docker
docker compose build        # Verify image builds
```
