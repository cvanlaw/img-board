# iPhone Photo Sync: Understanding Your Options

> **Document Type**: Explanation (Divio Framework)
> This document explores concepts and trade-offs. For step-by-step setup instructions, see the relevant How-to Guide once an approach is chosen.

## Introduction

img-board displays photos from a NAS directory, automatically processing and serving them as a slideshow. But how do photos from an iPhone get to that NAS directory in the first place?

This document explores the landscape of iPhone photo sync options—what's possible, what's difficult, and why certain approaches work better than others for different use cases.

## The Apple Ecosystem Challenge

Syncing photos from an iPhone to a server is surprisingly difficult compared to other platforms. Understanding why requires knowing how Apple structures photo access.

### No Public Web API

Apple does not provide a documented REST API for iCloud Photos. Unlike Google Photos or Dropbox, there's no official way to programmatically access iCloud photo libraries from a server.

The paths that do exist:

| Access Method | Availability | Limitation |
|--------------|--------------|------------|
| [PhotoKit](https://developer.apple.com/documentation/photokit) | iOS/macOS native apps only | Requires on-device code execution |
| CloudKit Web API | Public databases only | Cannot access user photo libraries |
| iCloud.com web interface | Browser sessions only | No programmatic API exposed |

### Reverse-Engineered Access

All server-side tools that sync iCloud photos use reverse-engineered, undocumented APIs. They work by mimicking browser authentication flows to iCloud.com. This means:

- **Fragility**: Apple can change APIs without notice, breaking tools
- **Authentication complexity**: Two-factor authentication must be handled
- **Trust tokens**: Tools cache MFA approval to avoid repeated prompts
- **Terms of service**: May technically violate Apple's ToS (though enforcement is rare for personal use)

### The 2FA Problem

Apple requires two-factor authentication for iCloud accounts. Any automated sync tool must handle this, typically through one of:

1. **Trust token caching** - After initial approval, store a token that bypasses 2FA for subsequent syncs
2. **SMS/Voice codes** - Receive codes via alternative channels (less reliable)
3. **Security key support** - Hardware keys (limited tool support)

Most tools cache trust tokens, requiring re-authentication only when tokens expire (typically 60-90 days) or when accessing from a new location.

## Understanding Album Types

iPhone Photos has several album types, each with different sync implications.

### Standard Albums

User-created collections. You manually add photos to these albums.

- **Sync support**: Best supported across all tools
- **Filtering**: Most tools can sync specific albums by name
- **Structure**: Preserved in most sync tools as folder hierarchy

### Smart Albums

Rule-based, dynamic collections (e.g., "Screenshots", "Selfies", "Videos").

- **Sync support**: Generally supported
- **Caveat**: Rules evaluate at sync time; new matches appear in subsequent syncs
- **Device-specific**: Some smart albums exist only on iOS, not in iCloud

### Shared Photo Library (iCloud)

Apple's family photo sharing feature where multiple Apple IDs contribute to a single library.

- **Sync support**: Partial
- **Limitation**: [icloud-photos-sync](https://github.com/steilerDev/icloud-photos-sync) supports this but cannot determine original folder hierarchy—all shared assets appear in a flat `_Shared-Photos` directory
- **API gap**: The undocumented API doesn't expose where shared assets belong in the contributor's folder structure

### Shared Albums (Invite-Based)

Cross-account sharing where you invite others to view or contribute.

- **Sync support**: Very limited
- **The hard problem**: These exist outside the user's main library structure
- **Workaround**: None reliable; shared album assets often cannot be synced via server-side tools

```
┌─────────────────────────────────────────────────────────┐
│                    Album Type Matrix                     │
├─────────────────────┬───────────────┬───────────────────┤
│ Album Type          │ Server Sync   │ Filter by Album   │
├─────────────────────┼───────────────┼───────────────────┤
│ Standard Albums     │ Full support  │ Yes               │
│ Smart Albums        │ Supported     │ Varies by tool    │
│ Shared Photo Library│ Partial       │ No (flat folder)  │
│ Shared Albums       │ Not supported │ N/A               │
└─────────────────────┴───────────────┴───────────────────┘
```

## Sync Approaches Explored

Three fundamental approaches exist, each with distinct trade-offs.

### A. iCloud-Based Tools (Server-Side Pull)

The server reaches into iCloud to pull photos down.

```
┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│ iPhone       │ ──────► │ iCloud Photos   │ ◄────── │ Server      │
│              │  sync   │ (Apple servers) │  pull   │ (your host) │
└──────────────┘         └─────────────────┘         └─────────────┘
```

#### icloud-photos-sync (Node.js)

[GitHub Repository](https://github.com/steilerDev/icloud-photos-sync)

A one-way sync engine that downloads the entire iCloud Photos library (or specific folders) to the local filesystem.

**Characteristics**:
- Written in Node.js/TypeScript
- Efficient differential sync for large libraries
- Supports archiving (mark folders to skip in future syncs)
- Includes WebUI for status monitoring
- MFA authentication via trusted devices, SMS, or voice
- Caches trust tokens for autonomous operation

**Album handling**:
- Syncs full library into folder hierarchy
- Can archive specific folders to exclude them
- Shared Photo Library assets land in `_Shared-Photos` (flat)

**Considerations**:
- Requires Apple ID credentials stored on server
- Uses undocumented APIs (may break)
- Live Photos support pending
- No shared album support

#### iCloud Photos Downloader (Python)

[GitHub Repository](https://github.com/icloud-photos-downloader/icloud_photos_downloader)

A Python CLI tool focused on downloading and syncing photos from iCloud.

**Characteristics**:
- Three modes: copy (new only), sync (with delete), move (delete from iCloud)
- `--watch-with-interval` for continuous monitoring
- Live Photos and RAW support
- Automatic de-duplication
- EXIF metadata updates

**Album handling**:
- Downloads all photos by default
- `--recent` flag for recent photos only
- No explicit album filtering in documentation

**Considerations**:
- Python dependency
- Requires Apple ID credentials on server
- 2FA handled via `--auth-only` preparation step

#### Trade-offs: Server-Side Pull

| Advantage | Disadvantage |
|-----------|--------------|
| Fully automated after setup | Credentials stored on server |
| No action required on phone | Uses undocumented APIs |
| Can sync entire library | Shared albums not supported |
| Efficient differential sync | Periodic re-authentication needed |

### B. Push-Based Approaches (Client-Initiated)

The phone pushes photos to the server.

```
┌──────────────┐                              ┌─────────────┐
│ iPhone       │ ────────── push ──────────► │ Server      │
│              │                              │ (your host) │
└──────────────┘                              └─────────────┘
```

#### PhotoSync iOS App

[PhotoSync Premium](https://www.photosync-app.com/premium)

A third-party iOS app designed for photo transfer with extensive automation options.

**Characteristics**:
- Transfers to FTP, SFTP, SMB, WebDAV, cloud services
- Shortcuts app integration for automation
- Location-based triggers (sync when arriving home)
- Time-based triggers (nightly sync)
- Custom album filtering (sync only specific albums)
- Background transfer support

**Album handling**:
- Can filter by specific albums (standard or smart)
- Transfers from Recents/All Photos or custom selection
- Preserves folder structure option

**Considerations**:
- Requires iOS app purchase (~$7 one-time for premium)
- Automation requires Shortcuts setup on device
- Must configure destination (FTP/SMB/WebDAV to NAS)
- Phone must be on network or have data for triggers

#### img-board Web Upload

The existing admin interface design (see `docs/PHOTO_UPLOAD_DESIGN.md`) supports direct file upload.

**Characteristics**:
- Upload via browser from any device
- No app installation required
- Immediate processing through existing pipeline

**Album handling**:
- Manual selection per upload
- No automated album sync

**Considerations**:
- Requires manual action
- Best for occasional additions, not continuous sync
- Works from any device, not just iPhone

#### Trade-offs: Push-Based

| Advantage | Disadvantage |
|-----------|--------------|
| No credentials on server | Requires phone-side setup |
| Uses official iOS APIs | Need network connectivity |
| Album filtering supported | Manual or triggered (not continuous) |
| Works with shared albums | Battery/data considerations |

### C. Hybrid Approaches

Combine multiple services to bridge gaps.

#### iCloud Drive as Intermediary

```
┌──────────────┐    export    ┌──────────────┐    sync    ┌─────────────┐
│ iPhone       │ ───────────► │ iCloud Drive │ ─────────► │ Server      │
│ Photos       │              │ folder       │            │             │
└──────────────┘              └──────────────┘            └─────────────┘
```

**How it works**:
1. Use iOS Shortcuts to export photos to an iCloud Drive folder
2. Sync that iCloud Drive folder to server via standard tools (rclone, etc.)
3. Server processes files through img-board pipeline

**Characteristics**:
- Decouples photo library access from server sync
- iCloud Drive has documented sync tools
- Can filter by album in Shortcuts before export

**Considerations**:
- Duplicates storage (Photos + Drive copy)
- Two-step process
- Export step needs triggering (manual or automated)

#### macOS Bridge (If Available)

```
┌──────────────┐    iCloud    ┌──────────────┐    export   ┌─────────────┐
│ iPhone       │ ───────────► │ macOS host   │ ──────────► │ Server      │
│ Photos       │    sync      │ Photos.app   │             │             │
└──────────────┘              └──────────────┘             └─────────────┘
```

**How it works**:
1. macOS syncs with iCloud Photos natively
2. PhotoKit/AppleScript accesses the local library
3. Export to a folder synced to server

**Characteristics**:
- Uses official Apple APIs on Mac
- Full album access including smart albums
- Better shared album support (native Photos app can access)

**Considerations**:
- Requires always-on Mac
- Not applicable to Docker-on-Linux deployments
- Complex setup (Mac + sync mechanism)

## Shared Albums: The Hard Problem

Private shared albums represent the most challenging sync scenario. Understanding why helps set expectations.

### Why It's Difficult

Shared albums exist in a separate namespace from your main library. When you view a shared album, you're accessing content stored in the contributor's account (or a shared container), not your own iCloud Photo Library.

The reverse-engineered APIs that power tools like icloud-photos-sync access your library's asset index. Shared albums aren't in that index—they're a different data structure entirely.

### Current State

| Tool | Shared Album Support |
|------|---------------------|
| icloud-photos-sync | No (Shared Photo Library yes, Shared Albums no) |
| icloud_photos_downloader | Not documented |
| PhotoSync app | Yes (accesses via iOS Photos framework) |
| macOS Photos export | Yes (native access) |

### Practical Workarounds

For shared albums, push-based approaches are currently the only reliable option:

1. **PhotoSync from iPhone** - Can select shared albums as source
2. **Manual export + upload** - Save shared album photos to Camera Roll, then sync Camera Roll
3. **macOS bridge** - If a Mac is available, Photos.app can access shared albums for export

## Integration with img-board

Regardless of which sync approach is chosen, integration follows the same pattern:

```
Any Sync Method
      │
      ▼
┌─────────────────────┐
│ /mnt/photos/raw/    │ ← Files land here
└──────────┬──────────┘
           │
    Chokidar detects
           │
           ▼
┌─────────────────────────────────┐
│ Preprocessor (preprocessor.js)  │
│ • Validates extensions          │
│ • Converts to WebP              │
│ • Resizes to target resolution  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ /mnt/photos/processed/          │
└──────────┬──────────────────────┘
           │
    Chokidar detects
           │
           ▼
┌─────────────────────────────────┐
│ Server (server.js)              │
│ • SSE broadcast to clients      │
│ • Slideshow updates             │
└─────────────────────────────────┘
```

**Key point**: img-board doesn't care how files arrive in `/mnt/photos/raw/`. Any method that deposits JPG/PNG files there works.

### Docker Deployment Considerations

When running img-board in Docker (the standard deployment):

- **No macOS APIs** - PhotoKit/AppleScript unavailable
- **Network access required** - For iCloud tools or receiving uploads
- **Volume mounts** - Sync destination must be mounted into container

The raw directory can be:
- A bind mount to a NAS share (SMB/NFS)
- A local directory synced externally (rclone, rsync)
- A directory that receives uploads via the admin API

## Choosing an Approach

The right choice depends on priorities:

### Decision Matrix

| Priority | Recommended Approach |
|----------|---------------------|
| Fully automated, hands-off | icloud-photos-sync or icloud_photos_downloader |
| No credentials on server | PhotoSync app with automation |
| Shared album support | PhotoSync app or macOS bridge |
| Simplest setup | Web upload (manual) |
| Album filtering | PhotoSync app or icloud-photos-sync |
| Docker-only deployment | iCloud tools or PhotoSync to mounted volume |

### Security Considerations

**Credentials on server** (iCloud tools):
- Store in environment variables, not config files
- Consider dedicated Apple ID for sync (not your primary)
- Monitor for unauthorized access

**Push-based** (PhotoSync, upload):
- Server receives files but doesn't hold credentials
- Authenticate uploads via IP filtering or tokens
- Consider HTTPS for transfers

### Reliability Considerations

**Most reliable**: Push-based approaches using official iOS APIs (PhotoSync)
- Not dependent on reverse-engineered APIs
- Survives Apple API changes

**Least reliable**: Tools using undocumented iCloud APIs
- May break when Apple updates services
- Community maintenance varies

## Summary

iPhone photo sync to img-board has no perfect solution due to Apple's closed ecosystem. The approaches range from fully automated server-side sync (using reverse-engineered APIs) to client-initiated push (using official iOS capabilities).

For most users:
- **Want automation + accept trade-offs**: Use icloud-photos-sync with MFA token caching
- **Want reliability + willing to set up**: Use PhotoSync app with Shortcuts automation
- **Need shared albums**: Push-based approaches are the only option

All approaches ultimately deposit files in the same place—img-board's raw directory—where the existing preprocessing pipeline takes over.

---

## References

- [icloud-photos-sync](https://github.com/steilerDev/icloud-photos-sync) - Node.js iCloud sync tool
- [iCloud Photos Downloader](https://github.com/icloud-photos-downloader/icloud_photos_downloader) - Python iCloud sync tool
- [PhotoSync App](https://www.photosync-app.com/premium) - iOS photo transfer app
- [Apple PhotoKit Documentation](https://developer.apple.com/documentation/photokit) - Official Apple framework (device-only)
- [Divio Documentation System](https://docs.divio.com/documentation-system/) - Documentation framework used for this document
