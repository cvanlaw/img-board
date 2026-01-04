# Manual Test Scripts

Manual testing procedures for the img-board slideshow application.

## Prerequisites

- Application running (Docker or local development)
- Access to raw image directory (`/mnt/photos/raw` or configured path)
- Access to processed image directory (`/mnt/photos/processed` or configured path)
- Sample test images (JPG, PNG) for preprocessing tests
- Browser with developer tools

## Running the Application

**Docker (production):**
```bash
docker compose up -d --build
docker compose logs -f
```

**Local development:**
```bash
npm install
node start.js
```

Default URLs:
- Slideshow: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`

## Test Scripts

| Script | Description |
|--------|-------------|
| [01-slideshow-basic.md](01-slideshow-basic.md) | Slideshow display, transitions, navigation |
| [02-sse-realtime-updates.md](02-sse-realtime-updates.md) | Real-time image add/remove via SSE |
| [03-admin-access.md](03-admin-access.md) | IP-based access control |
| [04-admin-slideshow-settings.md](04-admin-slideshow-settings.md) | Slideshow interval configuration |
| [05-admin-preprocessing-settings.md](05-admin-preprocessing-settings.md) | Image dimension settings |
| [06-image-preprocessing.md](06-image-preprocessing.md) | JPG/PNG to WebP conversion |
| [07-config-hot-reload.md](07-config-hot-reload.md) | Live config.json changes |
| [08-reprocessing-workflow.md](08-reprocessing-workflow.md) | Batch reprocessing trigger |
| [09-https-deployment.md](09-https-deployment.md) | TLS certificate configuration |
| [10-docker-deployment.md](10-docker-deployment.md) | Container startup and volumes |
| [11-end-to-end-workflow.md](11-end-to-end-workflow.md) | Complete user journey |

## Test Execution Order

Tests are numbered by dependency. Run in order for first-time validation:

1. **Basic functionality** (01-02): Core slideshow works
2. **Admin features** (03-05): Configuration interface works
3. **Processing** (06-08): Image pipeline works
4. **Deployment** (09-10): Production setup works
5. **End-to-end** (11): Full workflow validation

## Conventions

- **Prerequisites**: Setup required before test
- **Steps**: Numbered actions to perform
- **Expected**: What should happen
- **Notes**: Edge cases or important details
