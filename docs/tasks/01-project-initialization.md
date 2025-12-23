# Task 01: Project Initialization

## Description
Initialize the Node.js project with npm, create the directory structure, and set up the configuration template.

## Dependencies
None - this is the foundation task.

## Deliverables
- `package.json` - npm project configuration with dependencies
- `config.json` - Configuration template with default values
- `public/` directory structure
- `.gitignore` - Git ignore patterns

## Acceptance Criteria
- [ ] `npm install` runs without errors
- [ ] `config.json` contains all configuration options from ARCHITECTURE.md
- [ ] Directory structure matches planned layout:
  ```
  image-slideshow/
  ├── package.json
  ├── config.json
  ├── public/
  │   ├── css/
  │   └── js/
  └── .gitignore
  ```
- [ ] Dependencies include: express, chokidar, sharp
- [ ] `.gitignore` excludes node_modules, logs, temp files

## Implementation Details

### package.json
```json
{
  "name": "image-slideshow",
  "version": "1.0.0",
  "description": "Auto-updating image slideshow for DAKboard",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.0",
    "chokidar": "^3.5.0",
    "sharp": "^0.33.0"
  },
  "scripts": {
    "start": "node server.js",
    "preprocess": "node preprocessor.js",
    "dev": "NODE_ENV=development node server.js",
    "dev:preprocess": "NODE_ENV=development node preprocessor.js"
  }
}
```

### config.json Template
```json
{
  "preprocessing": {
    "enabled": true,
    "rawImagePath": "/mnt/nas/photos/raw",
    "processedImagePath": "/mnt/nas/photos/processed",
    "inputExtensions": [".jpg", ".jpeg", ".png"],
    "outputFormat": "webp",
    "quality": 85,
    "targetWidth": 1920,
    "targetHeight": 1080,
    "keepOriginals": true,
    "archivePath": "/mnt/nas/photos/archive"
  },
  "imagePath": "/mnt/nas/photos/processed",
  "imageExtensions": [".webp"],
  "slideshowInterval": 5000,
  "randomOrder": true,
  "reshuffleInterval": 3600000,
  "recursive": false,
  "port": 3000,
  "https": {
    "enabled": false,
    "cert": "/path/to/cert.pem",
    "key": "/path/to/key.pem"
  },
  "admin": {
    "enabled": true,
    "allowedIPs": []
  }
}
```

### .gitignore
```
node_modules/
logs/
*.log
.reprocess-trigger
.reprocess-progress.json
*.pem
.env
```

## Testing Checklist
- [ ] Run `npm install` - completes without errors
- [ ] Verify all dependencies installed in node_modules
- [ ] Validate config.json is valid JSON
- [ ] Verify directory structure exists
