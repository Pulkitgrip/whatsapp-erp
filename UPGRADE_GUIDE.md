# Upgrade Guide: Single-User to Multi-User WhatsApp ERP

This guide helps you migrate from the old single-user WhatsApp ERP system to the new multi-user system.

## 🔄 What's Changed

### Major Changes
- **Multi-User Support**: Each user can now connect their own WhatsApp account
- **Database Auth Storage**: Auth data moved from files to database (Vercel compatible)
- **Contact-Based Filtering**: Messages only stored from known contacts
- **Enhanced Security**: All WhatsApp endpoints now require authentication
- **Session Management**: Automatic cleanup of stale connections

### Breaking Changes
- All WhatsApp endpoints now require JWT authentication
- QR code endpoint moved and requires authentication
- Message storage logic changed (contact filtering)
- Auth data storage location changed
- API response formats updated

## 📋 Migration Steps

### 1. Backup Current Data
Before upgrading, backup your current data:
```bash
# Backup database
pg_dump your_database > backup_before_upgrade.sql

# Backup WhatsApp auth files (if any)
cp -r auth_info_baileys auth_info_baileys_backup
```

### 2. Update Database Schema
The new system requires additional database tables. Run the application once to auto-create them:
```bash
npm install
npm start
```

The application will automatically create new tables:
- `whatsapp_sessions` - Stores auth data per user
- Updated `conversations` table with `ownerId` field
- Updated `users` table with WhatsApp relations

### 3. Migrate Existing Data

#### Option A: Fresh Start (Recommended)
Start with a clean slate:
1. Let users create new accounts
2. Have each user connect their WhatsApp individually
3. Add contacts manually via the new API

#### Option B: Data Migration (Advanced)
If you have existing data to preserve:

```sql
-- Example migration script
-- Update existing conversations to assign to a specific user
UPDATE conversations 
SET owner_id = 1 -- Replace with appropriate user ID
WHERE owner_id IS NULL;

-- Create WhatsApp sessions for existing users who had connections
INSERT INTO whatsapp_sessions (user_id, is_connected, connection_state)
SELECT id, false, 'close'
FROM users
WHERE role IN ('admin', 'manager');
```

### 4. Update Environment Variables
Add new environment variables to your `.env` file:
```env
# Session Cleanup Configuration
SESSION_CLEANUP_INTERVAL=300000  # 5 minutes
STALE_CONNECTION_TIMEOUT=1800000 # 30 minutes

# WhatsApp Configuration  
MAX_RECONNECT_ATTEMPTS=5
RECONNECT_INTERVAL=5000

# Logging Configuration
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# File Upload Configuration
MAX_FILE_SIZE=10mb
```

### 5. Update Frontend/Client Code

#### Authentication Required
All WhatsApp endpoints now require authentication:
```javascript
// Before (no auth)
fetch('/api/whatsapp/status')

// After (with auth)
fetch('/api/whatsapp/status', {
  headers: {
    'Authorization': `Bearer ${jwt_token}`
  }
})
```

#### QR Code Endpoint Changed
```javascript
// Before
fetch('/api/whatsapp/qr')

// After (authenticated SSE)
const eventSource = new EventSource('/api/whatsapp/qr', {
  headers: {
    'Authorization': `Bearer ${jwt_token}`
  }
});
```

#### New Connection Flow
```javascript
// 1. User logs in
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { token } = await loginResponse.json();

// 2. Connect WhatsApp
await fetch('/api/whatsapp/connect', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Get QR code
const eventSource = new EventSource('/api/whatsapp/qr', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🔧 Configuration Changes

### Old Configuration
```env
AUTH_DIR=./auth_info_baileys
```

### New Configuration
Auth data is now stored in the database. Remove `AUTH_DIR` and add:
```env
SESSION_CLEANUP_INTERVAL=300000
STALE_CONNECTION_TIMEOUT=1800000
```

## 📱 User Workflow Changes

### Before (Single User)
1. One shared WhatsApp connection
2. Public QR code access
3. All messages stored regardless of sender

### After (Multi-User)
1. Each user creates account and logs in
2. Each user connects their own WhatsApp
3. Each user gets their own QR code
4. Only messages from known contacts are stored
5. Users must add contacts to enable message storage

## 🔒 Security Improvements

### Contact Management
Add contacts to enable message storage:
```javascript
await fetch('/api/whatsapp/contact/add', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mobileNo: '+1234567890',
    name: 'Customer Name'
  })
});
```

### Role-Based Access
```javascript
// Only admins can view all active sessions
await fetch('/api/whatsapp/sessions/active', {
  headers: { 'Authorization': `Bearer ${admin_token}` }
});
```

## 🚀 Deployment Changes

### Vercel Compatibility
The new system is fully compatible with Vercel:
- No file-based auth storage
- Database-based session management
- Automatic cleanup handling

### Environment Variables
Update your deployment environment variables:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
SESSION_CLEANUP_INTERVAL=300000
STALE_CONNECTION_TIMEOUT=1800000
```

## 📊 Monitoring & Maintenance

### New Monitoring Endpoints
```javascript
// Check cleanup statistics (admin only)
const stats = await fetch('/api/admin/cleanup-stats', {
  headers: { 'Authorization': `Bearer ${admin_token}` }
});

// Check individual user status
const status = await fetch('/api/whatsapp/status', {
  headers: { 'Authorization': `Bearer ${user_token}` }
});
```

### Automatic Cleanup
The system now automatically:
- Cleans up disconnected sessions
- Removes stale connections
- Synchronizes memory and database state

## ⚠️ Important Notes

1. **Contact Whitelist**: Messages are only stored from contacts in your database. Add contacts using `/api/whatsapp/contact/add`

2. **User Sessions**: Each user maintains their own WhatsApp connection. If a user loses connection, only their session is affected.

3. **Auth Storage**: WhatsApp auth data is now stored in the database, making it compatible with serverless deployments.

4. **API Changes**: All WhatsApp endpoints now require authentication. Update your client code accordingly.

5. **Session Management**: The system automatically monitors and cleans up sessions. No manual intervention required.

## 🆘 Troubleshooting

### Common Migration Issues

1. **Database Connection Errors**
   ```bash
   # Check database URL format
   DATABASE_URL=postgresql://user:pass@host:port/dbname
   ```

2. **Authentication Failures**
   ```bash
   # Ensure JWT_SECRET is set and consistent
   JWT_SECRET=your_super_secure_secret
   ```

3. **Messages Not Storing**
   ```bash
   # Add contacts via API
   POST /api/whatsapp/contact/add
   ```

4. **QR Code Not Showing**
   ```bash
   # Ensure authentication token is valid
   # Check /api/whatsapp/status first
   ```

### Getting Help
- Check the updated README.md
- Review API documentation at `http://localhost:5000/`
- Create an issue on GitHub with migration questions

---

**Note**: Take your time with the migration. Test thoroughly in a development environment before updating production systems. 