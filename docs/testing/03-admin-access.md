# 03 - Admin Access Control

Tests IP-based access restrictions for admin interface.

## Prerequisites

- Application running
- Access to config.json
- Ability to test from different IPs (or modify X-Forwarded-For)

---

## Test 3.1: Localhost Access

**Steps:**
1. Ensure you're accessing from localhost
2. Navigate to `http://localhost:3000/admin`

**Expected:**
- Admin page loads successfully
- All admin features accessible
- No 403 error

---

## Test 3.2: Admin API Localhost Access

**Steps:**
1. From localhost, run:
   ```bash
   curl http://localhost:3000/api/admin/config
   ```

**Expected:**
- Returns JSON configuration object
- HTTP 200 status
- No access denied error

---

## Test 3.3: Allowed IP Access

**Steps:**
1. Configure allowedIPs in config.json:
   ```json
   "admin": {
     "allowedIPs": ["192.168.1.0/24"]
   }
   ```
2. Restart application to load config
3. Access admin from IP in that range

**Expected:**
- Admin page loads successfully
- Same behavior as localhost

---

## Test 3.4: Denied IP Access

**Steps:**
1. Configure restrictive allowedIPs:
   ```json
   "admin": {
     "allowedIPs": ["10.0.0.1"]
   }
   ```
2. Access admin from different IP (not 10.0.0.1, not localhost)

**Expected:**
- HTTP 403 Forbidden returned
- "Access denied" message displayed
- Admin page does not load

---

## Test 3.5: API Denied Access

**Steps:**
1. With restrictive allowedIPs configured
2. From non-allowed IP, run:
   ```bash
   curl -I http://server-ip:3000/api/admin/config
   ```

**Expected:**
- HTTP 403 status code
- API does not return configuration data

---

## Test 3.6: CIDR Subnet Matching

**Steps:**
1. Configure CIDR notation:
   ```json
   "admin": {
     "allowedIPs": ["192.168.1.0/24"]
   }
   ```
2. Test access from 192.168.1.50
3. Test access from 192.168.2.50

**Expected:**
- 192.168.1.50 → Access granted
- 192.168.2.50 → Access denied (403)

---

## Test 3.7: Slideshow Unaffected

**Steps:**
1. Configure restrictive admin allowedIPs
2. From non-allowed IP, access `http://server-ip:3000/`

**Expected:**
- Slideshow loads normally
- No access restrictions on main page
- Only `/admin` and `/api/admin/*` are protected

---

## Notes

- Localhost (127.0.0.1, ::1) is always allowed
- CIDR /24 format supported for subnet ranges
- Config changes require process reload to take effect
- Protection applies to both HTML page and API endpoints
