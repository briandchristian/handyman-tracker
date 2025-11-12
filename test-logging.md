# Authentication Logging - Test Guide

## What's Been Added

Comprehensive logging has been added to track all authentication activities with **improved IP detection for remote/LAN clients**:

### 1. Login Logging
- ✅ Successful logins with username and IP
- ❌ Failed logins (user not found, wrong password, missing credentials)
- ❌ Server errors during login

### 2. Registration Logging
- ✅ Successful registrations with username and IP
- ❌ Failed registrations (validation errors, duplicate users)
- ❌ Server errors during registration

### 3. Token Validation Logging
- ✅ Successful token validation with user ID and endpoint
- ❌ Failed validations (no token, expired token, invalid token)

## Log Format

All logs include:
- **Timestamp**: ISO 8601 format
- **Status**: ✅ (success) or ❌ (failure)
- **Event Type**: LOGIN, REGISTRATION, or AUTH
- **Details**: Specific reason for failure or success info
- **IP Address**: Client IP (enhanced detection for LAN clients)
- **Endpoint**: For auth middleware, shows which endpoint was accessed

## Enhanced IP Detection

The server now properly detects client IPs from:
- ✅ **Direct connections** (localhost)
- ✅ **LAN connections** (remote computers on your network)
- ✅ **Proxy connections** (if behind a reverse proxy)

The server uses multiple methods in this order:
1. `X-Forwarded-For` header (for proxied connections)
2. Express `req.ip` (with trust proxy enabled)
3. Socket remote address (fallback)

IPv6 addresses are automatically cleaned (removes `::ffff:` prefix).

## Example Log Output

### Successful Login
```
[2025-11-10T10:30:45.123Z] ✅ LOGIN SUCCESS - User: "admin" - IP: 192.168.50.124
```

### Failed Login (Wrong Password)
```
[2025-11-10T10:31:12.456Z] ❌ LOGIN FAILED - Invalid password for user: "admin" - IP: 192.168.50.124
```

### Failed Login (User Not Found)
```
[2025-11-10T10:32:05.789Z] ❌ LOGIN FAILED - User not found: "hacker123" - IP: 192.168.50.87
```

### Token Validation Success
```
[2025-11-10T10:33:20.012Z] ✅ AUTH SUCCESS - User ID: 507f1f77bcf86cd799439011 - IP: 192.168.50.124 - Endpoint: /api/customers
```

### Token Validation Failure (Expired)
```
[2025-11-10T11:35:45.678Z] ❌ AUTH FAILED - Invalid/Expired token - IP: 192.168.50.124 - Endpoint: /api/customers - Error: jwt expired
```

## How to Test

1. **Restart the backend server** (required to apply changes):
   ```bash
   cd "f:\AI Projects\handyman-tracker\backend"
   npm start
   ```

2. **Watch the console** - You should see the startup banner:
   ```
   ============================================================
   🚀 Server running on port 5000 (accessible on LAN)
   📝 Authentication logging: ENABLED (with IP detection)
      - Login attempts will be logged
      - Token validation will be tracked
      - Client IP addresses will be recorded
      - Trust proxy: ENABLED for LAN clients
   ============================================================
   ```

   You'll also see incoming authentication requests:
   ```
   [2025-11-10T10:30:00.000Z] 📥 POST /api/login - IP: 192.168.50.124
   ```

3. **Test from a LAN client**:
   - Try logging in with correct credentials → See ✅ LOGIN SUCCESS
   - Try logging in with wrong password → See ❌ LOGIN FAILED
   - Try accessing protected endpoints → See ✅ AUTH SUCCESS or ❌ AUTH FAILED

4. **Test from localhost**:
   - Navigate to http://192.168.50.87:5173
   - Attempt login → Check backend console for logs

## Troubleshooting Failed Logins

Based on the log messages, you can identify:

1. **Network Issues**: Check the IP address in logs
2. **Wrong Credentials**: Look for "Invalid password" or "User not found"
3. **Token Issues**: Check for "expired" or "invalid" token messages
4. **Server Errors**: Look for ERROR messages with stack traces

## Security Notes

- Passwords are NEVER logged
- Only usernames and IP addresses are recorded
- Failed login attempts can help identify brute force attacks
- Monitor for repeated failed attempts from the same IP

