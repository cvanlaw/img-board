# Task 10: HTTPS Support

## Description
Add HTTPS/TLS support to the Express server to enable secure connections required for DAKboard iframe embedding.

## Dependencies
- Task 03: Express Server Core

## Deliverables
- Updated `server.js` with conditional HTTPS support
- Updated `config.json` schema for HTTPS settings

## Acceptance Criteria
- [ ] Server starts with HTTPS when `https.enabled: true`
- [ ] Server starts with HTTP when `https.enabled: false`
- [ ] TLS certificate and key loaded from configured paths
- [ ] Clear error message if cert/key files not found
- [ ] Works with both self-signed and CA-signed certificates
- [ ] CORS headers set if needed for cross-origin iframe

## Implementation Details

### Server HTTPS Setup
```javascript
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');

const config = require('./config.json');
const app = express();

// ... Express routes setup ...

// Start server with HTTP or HTTPS
function startServer() {
  if (config.https?.enabled) {
    try {
      const options = {
        cert: fs.readFileSync(config.https.cert),
        key: fs.readFileSync(config.https.key)
      };

      https.createServer(options, app).listen(config.port, () => {
        log('info', 'HTTPS server started', { port: config.port });
      });
    } catch (err) {
      log('error', 'Failed to start HTTPS server', {
        error: err.message,
        cert: config.https.cert,
        key: config.https.key
      });
      process.exit(1);
    }
  } else {
    http.createServer(app).listen(config.port, () => {
      log('info', 'HTTP server started', { port: config.port });
    });
  }
}

startServer();
```

### Config Schema
```json
{
  "https": {
    "enabled": true,
    "cert": "/path/to/cert.pem",
    "key": "/path/to/key.pem"
  }
}
```

### Docker Volume Mount for Certs
```yaml
# In docker-compose.yml
volumes:
  - /path/to/cert.pem:/certs/cert.pem:ro
  - /path/to/key.pem:/certs/key.pem:ro
```

Config for Docker:
```json
{
  "https": {
    "enabled": true,
    "cert": "/certs/cert.pem",
    "key": "/certs/key.pem"
  }
}
```

### CORS Headers (if needed)
```javascript
// Add before routes if DAKboard needs CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

### Self-Signed Certificate Generation (for testing)
```bash
# Generate self-signed cert (development only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=localhost"
```

### Certificate Considerations

1. **DAKboard requires valid HTTPS**: Self-signed certs won't work in production
2. **Wildcard certs**: If you have `*.yourdomain.com`, use a subdomain like `slideshow.yourdomain.com`
3. **Let's Encrypt**: Can use certbot for free CA-signed certs
4. **Certificate renewal**: Place renewed certs in same path, server restart required

### Alternative: nginx Reverse Proxy

If using nginx for SSL termination:

```nginx
server {
    listen 443 ssl;
    server_name slideshow.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;  # Critical for SSE
        proxy_cache off;      # Critical for SSE
    }
}
```

With nginx proxy, set `https.enabled: false` in config.json (nginx handles TLS).

## Testing Checklist
- [ ] HTTP mode: Server starts on configured port
- [ ] HTTPS mode: Server starts with valid cert
- [ ] HTTPS mode: Browser connects without warning (valid cert)
- [ ] HTTPS mode: Self-signed cert shows warning but works
- [ ] Missing cert file - clear error message and exit
- [ ] Missing key file - clear error message and exit
- [ ] Invalid cert - clear error message
- [ ] Slideshow accessible via HTTPS
- [ ] SSE works over HTTPS
- [ ] DAKboard iframe loads content (valid cert only)
