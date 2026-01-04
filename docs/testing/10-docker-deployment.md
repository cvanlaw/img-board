# 10 - Docker Deployment

Tests containerized deployment and volume management.

## Prerequisites

- Docker and Docker Compose installed
- NAS directories accessible on host
- docker-compose.yml configured
- Valid config.json

---

## Test 10.1: Build Container

**Steps:**
1. From project root, run:
   ```bash
   docker compose build
   ```

**Expected:**
- Build completes without errors
- Image created successfully
- All npm dependencies installed

---

## Test 10.2: Start Container

**Steps:**
1. Start container:
   ```bash
   docker compose up -d
   ```
2. Check container status:
   ```bash
   docker compose ps
   ```

**Expected:**
- Container status shows "Up"
- No immediate exit or crash
- Port 3000 mapped correctly

---

## Test 10.3: Both Processes Running

**Steps:**
1. With container running, check logs:
   ```bash
   docker compose logs
   ```
2. Look for both process startup messages

**Expected:**
- Logs show server.js started
- Logs show preprocessor.js started
- Both processes initialized successfully

---

## Test 10.4: NAS Volume Mounts

**Steps:**
1. Check container can access mounted directories:
   ```bash
   docker compose exec img-board ls -la /mnt/photos/raw
   docker compose exec img-board ls -la /mnt/photos/processed
   ```

**Expected:**
- Directories accessible inside container
- Files visible if present on host
- Permissions allow read/write

---

## Test 10.5: Live Logs

**Steps:**
1. Start following logs:
   ```bash
   docker compose logs -f
   ```
2. Add image to raw directory
3. Watch log output

**Expected:**
- Processing log messages appear
- Both stdout and stderr captured
- JSON structured logging visible

---

## Test 10.6: Container Restart

**Steps:**
1. Stop container:
   ```bash
   docker compose stop
   ```
2. Start again:
   ```bash
   docker compose start
   ```
3. Verify operation

**Expected:**
- Container restarts successfully
- Application resumes normal operation
- Config loaded correctly

---

## Test 10.7: Automatic Restart on Crash

**Steps:**
1. Find container process ID
2. Kill a process inside container (simulate crash):
   ```bash
   docker compose exec img-board pkill -f "node start.js"
   ```
3. Wait a few seconds
4. Check container status

**Expected:**
- Container restarts automatically
- `restart: unless-stopped` policy honored
- Application recovers

---

## Test 10.8: Rebuild After Code Change

**Steps:**
1. Make a code change (add console.log)
2. Rebuild and redeploy:
   ```bash
   docker compose up -d --build
   ```
3. Check logs for change

**Expected:**
- Container rebuilds with new code
- Old container replaced
- Change visible in logs

---

## Test 10.9: Clean Shutdown

**Steps:**
1. Stop container gracefully:
   ```bash
   docker compose down
   ```
2. Check for proper shutdown

**Expected:**
- SIGTERM handled properly
- Processes exit cleanly
- No orphaned resources

---

## Test 10.10: Config Volume Mount

**Steps:**
1. Verify config.json is mounted:
   ```bash
   docker compose exec img-board cat /app/config.json
   ```
2. Edit config.json on host
3. Check if container sees changes

**Expected:**
- Config file accessible in container
- Host changes visible inside container
- Hot reload works through volume mount

---

## Test 10.11: Persistent Data

**Steps:**
1. Add images, let them process
2. Stop container: `docker compose down`
3. Start container: `docker compose up -d`
4. Verify images still present

**Expected:**
- Processed images persist (on NAS volume)
- No data loss on container restart
- Slideshow shows same images

---

## Notes

- start.js spawns both preprocessor and server
- PM2 NOT used (Docker manages processes)
- Volumes mount NAS directories from host
- Container logs: `docker compose logs -f`
