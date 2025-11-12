# Error Detection and Handling Guide

## ✅ Now Detecting Connection Refused Errors

The application now properly detects and displays helpful error messages for different types of connection issues.

## Error Types Detected

### 1. **Connection Refused (ERR_ECONNREFUSED)**
**When it happens:** Backend server is not running or unreachable

**User sees:**
```
❌ Connection Refused!

The server at http://192.168.50.87:5000 refused the connection.

• Check if the backend server is running
• Verify you're using the correct URL
```

**Console logs:**
```javascript
{
  type: 'connection_refused',
  code: 'ECONNREFUSED',
  url: 'http://192.168.50.87:5000/api/login',
  method: 'POST'
}
```

---

### 2. **Network Error (ERR_NETWORK)**
**When it happens:** Cannot reach server at all (wrong IP, server down, firewall)

**User sees:**
```
❌ Cannot connect to server at http://192.168.50.87:5000

Possible issues:
• Server is not running
• Wrong IP address (check if you're using http://192.168.50.87:5000)
• Network connectivity problem
• Firewall blocking connection

Make sure you're accessing from: http://192.168.50.87:5173
```

**This specifically helps when:**
- Client is using `localhost` instead of server IP
- Firewall is blocking the connection
- Server IP changed
- Backend server is down

---

### 3. **Invalid Credentials (HTTP 400)**
**When it happens:** Wrong username or password

**User sees:**
```
❌ Login Failed

Invalid username or password.
```

---

### 4. **Server Error (HTTP 500)**
**When it happens:** Backend server crashed or has a bug

**User sees:**
```
❌ Server Error

The server encountered an error. Please try again later.
```

---

### 5. **Timeout (ECONNABORTED)**
**When it happens:** Server takes too long to respond

**User sees:**
```
❌ Connection Timeout

The server took too long to respond.

• Check your network connection
• The server might be overloaded
• Try again in a moment
```

---

### 6. **Bad Gateway (HTTP 502)**
**When it happens:** Proxy/gateway can't reach backend

**User sees:**
```
❌ Bad Gateway

The server is temporarily unavailable.

• The backend server might be down
• Network configuration issue
• Contact your system administrator
```

---

## Benefits

### For Users:
- Clear, actionable error messages
- Specific troubleshooting steps
- No more generic "Login failed" messages

### For Administrators:
- Detailed console logs with error codes
- Easy to diagnose connection issues
- Helps identify if problem is client-side or server-side

### For Debugging:
Every error logs detailed information to console:
```javascript
{
  type: 'network',
  code: 'ERR_NETWORK',
  message: 'Network Error',
  status: undefined,
  response: undefined,
  url: 'http://192.168.50.87:5000/api/login',
  method: 'POST'
}
```

---

## How It Works

### Detection Logic:

```javascript
if (!err.response) {
  // No response = network/connection error
  if (err.code === 'ERR_NETWORK') → Network Error
  if (err.code === 'ECONNREFUSED') → Connection Refused
  if (err.code === 'ECONNABORTED') → Timeout
} else {
  // Got response = server error
  if (err.response.status === 400) → Bad Request
  if (err.response.status === 401) → Unauthorized
  if (err.response.status === 500) → Server Error
  if (err.response.status === 502) → Bad Gateway
}
```

---

## Common Scenarios

### Scenario 1: Client using wrong URL
**Problem:** Client accessing `http://localhost:5173`
**Detection:** ERR_NETWORK or ECONNREFUSED
**Message:** Shows correct URL (http://192.168.50.87:5173)

### Scenario 2: Backend server down
**Problem:** Backend not running
**Detection:** ECONNREFUSED
**Message:** "Check if the backend server is running"

### Scenario 3: Wrong credentials
**Problem:** Invalid username/password
**Detection:** HTTP 400
**Message:** "Invalid username or password"

### Scenario 4: Network/firewall issue
**Problem:** Port 5000 blocked
**Detection:** ERR_NETWORK or ECONNREFUSED
**Message:** "Firewall blocking connection"

---

## Testing the Error Detection

### Test 1: Connection Refused
1. Stop the backend server
2. Try to login
3. Should see "Connection Refused" message

### Test 2: Network Error
1. Change API_BASE_URL to wrong IP
2. Try to login
3. Should see "Cannot connect to server" with troubleshooting steps

### Test 3: Invalid Credentials
1. Backend running normally
2. Enter wrong password
3. Should see "Invalid username or password"

### Test 4: Server Error
1. Temporarily break backend code
2. Try to login
3. Should see "Server Error"

---

## Files Modified

- ✅ `frontend/src/components/Login.jsx` - Enhanced error handling for login
- ✅ `frontend/src/utils/errorHandler.js` - Reusable error detection utility
- ✅ Backend logging added to track connection attempts from different IPs

---

## Next Steps (Optional)

To use the error handler utility in other components:

```javascript
import { handleApiError, formatErrorAlert, logError } from '../utils/errorHandler';

try {
  const res = await axios.post(...);
  // handle success
} catch (err) {
  const errorInfo = handleApiError(err, 'ComponentName');
  logError('ComponentName', err, errorInfo);
  alert(formatErrorAlert(errorInfo));
}
```

This provides consistent error handling across the entire application.

