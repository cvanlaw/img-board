---
id: 25
title: Upgrade Multer to 2.x
depends_on: []
status: pending
---

# Task 25: Upgrade Multer to 2.x

## Description

Upgrade the multer package from 1.4.5-lts.2 to 2.x to resolve a high-severity vulnerability (CVSS 7.5) in the transitive `qs` dependency that allows DoS via memory exhaustion.

## Deliverables

- `package.json` - Updated multer dependency to 2.x
- `server.js` - Updated multer usage if API changes required

## Acceptance Criteria

- [ ] Multer upgraded to latest 2.x version
- [ ] No `npm audit` vulnerabilities related to multer/qs
- [ ] No npm deprecation warnings for multer
- [ ] File upload functionality works (single and multiple files)
- [ ] File size limits enforced correctly
- [ ] File type filtering works (images only)
- [ ] MulterError handling still functions

## Implementation Details

### Upgrade Command

```bash
npm install multer@2
```

### API Changes to Review

Multer 2.x has breaking changes. Review the migration guide:
https://github.com/expressjs/multer/releases

Current usage in server.js (lines 62-89, 196):
- `multer.diskStorage()` - storage configuration
- `multer()` - middleware creation with limits and fileFilter
- `multer.MulterError` - error type checking

### Current Configuration

```javascript
const uploadStorage = multer.diskStorage({
  destination: config.rawPath,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|heic|heif|raw|cr2|nef|arw/i;
    const ext = path.extname(file.originalname).slice(1);
    cb(null, allowed.test(ext));
  }
});
```

## Testing Checklist

- [ ] Run `npm audit` - no multer/qs vulnerabilities
- [ ] Run `npm ls multer` - shows 2.x version
- [ ] Upload single image via admin UI
- [ ] Upload multiple images via admin UI
- [ ] Attempt upload of oversized file (>50MB) - rejected
- [ ] Attempt upload of non-image file - rejected
- [ ] Verify uploaded files appear in raw directory
- [ ] Verify preprocessor converts uploaded images

## References

- Advisory: [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p)
- Migration: https://github.com/expressjs/multer/releases
