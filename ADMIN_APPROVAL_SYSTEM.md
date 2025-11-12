# Admin Approval System

## Overview

A secure multi-level admin system where new admin users must be approved by existing admins before gaining access.

## User Roles

### 1. **Super Admin**
- Full system access
- Can approve/reject users
- Can promote admins to super-admin
- Can delete users
- **First user automatically becomes super-admin**

### 2. **Admin**
- Can approve/reject new users
- Manage customers and projects
- Cannot delete users or promote to super-admin

### 3. **Pending** (Not yet approved)
- Cannot log in
- Waiting for admin approval

## How It Works

### For New Users (Requesting Access)

1. **Visit the login page** at `https://handyman-tracker.vercel.app`

2. **Click "New Admin? Request Access"** below the Admin Login form

3. **Fill out registration form:**
   - Username (min 3 characters)
   - Email
   - Password (min 6 characters)
   - Confirm Password

4. **Submit request**
   - You'll see a message that your account is pending approval
   - **Special case:** If you're the very first user, you become super-admin immediately!

5. **Wait for approval**
   - An existing admin will review your request
   - You'll be able to log in once approved

6. **Try logging in**
   - If still pending: You'll see "Your account is pending admin approval"
   - If rejected: "Your account has been rejected"
   - If approved: You can access the dashboard!

### For Admins (Approving Users)

1. **Log in to dashboard**

2. **Click "👥 Manage Users"** in the top right

3. **View pending requests**
   - See all users waiting for approval
   - View their username, email, and registration date

4. **Approve or Reject:**
   - **✓ Approve:** User becomes an admin and can log in
   - **✗ Reject:** User cannot log in

5. **Manage existing users (All Users tab):**
   - View all users and their roles
   - **Promote to Super Admin** (super-admin only)
   - **Delete users** (super-admin only, cannot delete yourself)

## API Endpoints

### Public
- `POST /api/register` - Request admin access (anyone can register)
- `POST /api/login` - Login (checks approval status)

### Admin Only
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/pending` - List pending users
- `PUT /api/admin/users/:id/approve` - Approve user
- `PUT /api/admin/users/:id/reject` - Reject user

### Super Admin Only
- `PUT /api/admin/users/:id/promote` - Promote to super-admin
- `DELETE /api/admin/users/:id` - Delete user

## Database Schema

### User Model

```javascript
{
  username: String (unique, required),
  password: String (hashed, required),
  email: String (required),
  role: String (enum: ['pending', 'admin', 'super-admin']),
  status: String (enum: ['pending', 'approved', 'rejected']),
  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,
  createdAt: Date
}
```

## Security Features

1. **Password Hashing:** All passwords encrypted with bcryptjs
2. **JWT Authentication:** Token-based auth with expiration
3. **Email Validation:** Ensures valid email format
4. **Role-Based Access Control:** Different permissions for each role
5. **Cannot Delete Self:** Prevents admins from deleting their own account
6. **Approval Tracking:** Records who approved each user and when

## User Flow Diagram

```
New User
   ↓
Register (status: pending, role: pending)
   ↓
Wait for Approval
   ↓
Admin Reviews ──→ Approve (status: approved, role: admin) ──→ Can Login
   │
   └──→ Reject (status: rejected) ──→ Cannot Login
```

## First-Time Setup

### Creating the First Super Admin

1. **No users exist in database**
2. **First person to register:**
   - Automatically gets `role: 'super-admin'`
   - Automatically gets `status: 'approved'`
   - Can log in immediately
   - No approval needed!

3. **This super-admin can then:**
   - Approve future registration requests
   - Promote other admins to super-admin
   - Manage all users

## Testing the System

### Scenario 1: First User
```bash
# Register first user
POST /api/register
{
  "username": "admin1",
  "password": "password123",
  "email": "admin1@example.com"
}

# Response: "First user created successfully as super-admin"
# Can log in immediately!
```

### Scenario 2: Subsequent Users
```bash
# Register second user
POST /api/register
{
  "username": "admin2",
  "password": "password123",
  "email": "admin2@example.com"
}

# Response: "Registration successful! Your account is pending admin approval"
# Cannot log in yet

# Try to log in
POST /api/login
{
  "username": "admin2",
  "password": "password123"
}

# Response: 403 "Your account is pending admin approval"

# Admin1 approves admin2
PUT /api/admin/users/{admin2_id}/approve
Authorization: Bearer {admin1_token}
{ "role": "admin" }

# Now admin2 can log in!
```

## Benefits

1. **Security:** Only approved users can access the system
2. **Control:** Admins decide who gets access
3. **Accountability:** Track who approved each user
4. **Flexibility:** Multiple admin levels with different permissions
5. **Easy Setup:** First user automatically becomes super-admin

## Future Enhancements (Ideas)

- Email notifications when approved/rejected
- User profile pages
- Audit log of all admin actions
- Temporary access links
- Password reset functionality
- Two-factor authentication

---

**Your admin approval system is now live at:** `https://handyman-tracker.vercel.app` 🎉

