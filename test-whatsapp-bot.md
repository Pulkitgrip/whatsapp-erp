# WhatsApp Bot Testing Guide

## ✅ Database Migration Completed!

Your WhatsApp bot system has been successfully migrated to the new multi-user architecture. Here's how to test and use it:

## 🔧 What Was Fixed

1. **Database Schema Updated**: Added missing WhatsApp tables (WhatsAppSessions, Conversations, Messages, BotResponses)
2. **User Model Fixed**: Removed duplicate field definitions
3. **Multi-User Support**: Each user can now connect their own WhatsApp account
4. **Bot Responses Created**: Default bot responses for "hi", "hello", and "help"

## 🚀 How to Test Your Bot

### Step 1: Login or Create Account
```bash
# Create a new user account
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'

# Or login with existing account
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.local",
    "password": "admin123"
  }'
```

### Step 2: Connect Your WhatsApp
```bash
# Get your JWT token from login response, then:
curl -X POST http://localhost:5000/api/whatsapp/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 3: Get QR Code
```bash
# Get QR code to scan with your phone
curl -X GET http://localhost:5000/api/whatsapp/qr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Scan QR Code
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices
3. Tap "Link a Device"
4. Scan the QR code from Step 3

### Step 5: Test Bot Responses
Once connected, send these messages to your WhatsApp number:

- **"hi"** - Should get welcome message
- **"hello"** - Should get welcome message  
- **"help"** - Should get help menu
- **"catalog"** - Should get product catalog
- **Any other message** - Should get default response

## 🔍 Troubleshooting

### Check Connection Status
```bash
curl -X GET http://localhost:5000/api/whatsapp/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Active Sessions (Admin Only)
```bash
curl -X GET http://localhost:5000/api/whatsapp/sessions/active \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Recent Messages (Admin Only)  
```bash
curl -X GET http://localhost:5000/api/whatsapp/debug/recent-messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🤖 How the Bot Works Now

1. **Multi-User**: Each user connects their own WhatsApp account
2. **Message Processing**: Bot responds to messages from ANY phone number (not just registered users)
3. **Temporary Users**: Creates temporary user records for unknown senders
4. **Database Storage**: All messages are stored in the database
5. **Bot Responses**: Configurable responses in BotResponses table

## 🎯 Key Differences from Before

- **Before**: Single WhatsApp connection, only responded to registered users
- **Now**: Multi-user system, responds to all messages, creates temporary users

## 📝 Adding More Bot Responses

You can add custom bot responses to the database:

```sql
INSERT INTO "BotResponses" ("triggerKeyword", "responseText", "isActive", "priority", "createdAt", "updatedAt")
VALUES ('price', 'Please type "catalog" to see our products and prices.', true, 5, NOW(), NOW());
```

## 🚨 Important Notes

1. Each user must connect their own WhatsApp account
2. QR codes expire after ~30 seconds - regenerate if needed
3. Bot will respond to messages from any phone number
4. All conversations are stored in the database
5. The system now supports multiple WhatsApp accounts simultaneously

## ✅ Your bot should now be working! Send "hi" to test it. 