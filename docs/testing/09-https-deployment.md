# 09 - HTTPS Deployment

Tests TLS certificate configuration for secure connections.

## Prerequisites

- Valid TLS certificate and key files (self-signed OK for testing)
- Access to config.json
- Browser for HTTPS verification
- openssl command for certificate verification

---

## Test 9.1: HTTP Mode (Default)

**Steps:**
1. Ensure config.json has:
   ```json
   "https": {
     "enabled": false
   }
   ```
2. Start application
3. Access `http://localhost:3000/`

**Expected:**
- Application serves over HTTP
- No TLS/SSL errors
- Slideshow loads normally

---

## Test 9.2: HTTPS Mode - Valid Certificates

**Steps:**
1. Generate test certificates (if needed):
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout test-key.pem -out test-cert.pem \
     -subj "/CN=localhost"
   ```
2. Configure config.json:
   ```json
   "https": {
     "enabled": true,
     "certPath": "/path/to/test-cert.pem",
     "keyPath": "/path/to/test-key.pem"
   }
   ```
3. Restart application
4. Access `https://localhost:3000/`

**Expected:**
- Application serves over HTTPS
- Browser shows certificate warning (self-signed)
- After accepting, slideshow loads

---

## Test 9.3: Certificate Verification

**Steps:**
1. With HTTPS running, verify certificate:
   ```bash
   openssl s_client -connect localhost:3000 -showcerts
   ```

**Expected:**
- Certificate details displayed
- Subject matches configured cert
- Connection established

---

## Test 9.4: Missing Certificate File

**Steps:**
1. Configure config.json with non-existent cert path:
   ```json
   "https": {
     "enabled": true,
     "certPath": "/nonexistent/cert.pem",
     "keyPath": "/path/to/key.pem"
   }
   ```
2. Start application
3. Check logs

**Expected:**
- Clear error message with cert path
- Application exits gracefully (process.exit(1))
- Does not crash with cryptic error

---

## Test 9.5: Missing Key File

**Steps:**
1. Configure with non-existent key path
2. Start application
3. Check logs

**Expected:**
- Clear error message with key path
- Graceful exit
- Message indicates which file is missing

---

## Test 9.6: Invalid Certificate Format

**Steps:**
1. Create an invalid cert file:
   ```bash
   echo "not a certificate" > bad-cert.pem
   ```
2. Configure HTTPS with bad-cert.pem
3. Start application

**Expected:**
- Error about invalid certificate
- Application fails to start
- Clear error message

---

## Test 9.7: HTTP Redirect (Optional)

**Steps:**
1. If HTTP redirect is configured
2. Access `http://localhost:3000/`
3. Check redirect behavior

**Expected:**
- Redirects to HTTPS (if implemented)
- Or: HTTP returns error/unavailable (if HTTPS-only)

---

## Test 9.8: Admin Over HTTPS

**Steps:**
1. With HTTPS enabled
2. Access `https://localhost:3000/admin`
3. Test admin functionality

**Expected:**
- Admin page loads over HTTPS
- API calls work over HTTPS
- Settings can be saved

---

## Test 9.9: SSE Over HTTPS

**Steps:**
1. With HTTPS enabled
2. Open slideshow
3. Add image to processed directory
4. Check SSE connection in browser dev tools

**Expected:**
- SSE endpoint works over HTTPS
- Real-time updates still function
- No mixed content warnings

---

## Notes

- HTTPS required for DAKboard iframe embedding
- Self-signed certs work for testing but not production DAKboard
- Let's Encrypt recommended for production
- Port remains 3000 by default (configure in server.js if needed)
