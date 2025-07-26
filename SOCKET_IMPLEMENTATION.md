# WhatsApp Socket Implementation Guide

This document explains the complete Socket.IO implementation for real-time WhatsApp messaging in the ERP system.

## Overview

The socket implementation enables real-time communication between the frontend and backend for WhatsApp messaging, providing instant message delivery, connection status updates, and seamless user experience.

## Backend Implementation

### 1. Socket Service (`whatsapp-erp/src/services/socketService.js`)

**Features:**
- User authentication via JWT tokens
- Room-based messaging (user rooms and conversation rooms)
- Real-time message sending and receiving
- WhatsApp connection status updates
- Error handling and logging

**Key Methods:**
- `initialize(server)` - Initialize Socket.IO server
- `emitNewMessage(ownerId, message)` - Emit new messages to users
- `emitConnectionStatus(userId, status)` - Emit WhatsApp status updates
- `emitToConversation(conversationId, event, data)` - Emit to conversation rooms

### 2. Integration with WhatsApp Service

The `whatsappMultiUserService.js` has been enhanced to emit socket events:

- **New incoming messages** - Emitted to user rooms when messages are received
- **Outgoing messages** - Emitted to conversation rooms when messages are sent
- **Connection status changes** - Emitted when WhatsApp connection state changes

### 3. Server Setup

The main server (`src/index.js`) now includes:
```javascript
const http = require('http');
const socketService = require('./services/socketService');

const server = http.createServer(app);
socketService.initialize(server);
```

## Frontend Implementation

### 1. Enhanced Socket Provider (`erp-whatsapp/src/providers/socket-provider.tsx`)

**Features:**
- Automatic authentication with JWT tokens
- Custom event dispatching for component communication
- Connection state management
- Helper functions for common socket operations

**Context Methods:**
- `sendMessage(to, message, conversationId)` - Send messages via socket
- `joinConversation(conversationId)` - Join conversation rooms
- `leaveConversation(conversationId)` - Leave conversation rooms
- `getConnectionStatus()` - Request WhatsApp connection status

### 2. WhatsApp Socket Hook (`erp-whatsapp/src/hooks/useWhatsAppSocket.ts`)

A custom hook providing WhatsApp-specific socket functionality:

```typescript
const {
  isSocketConnected,
  isSocketAuthenticated,
  sendWhatsAppMessage,
  joinWhatsAppConversation,
  lastMessage,
  lastError,
  isWhatsAppConnected
} = useWhatsAppSocket();
```

### 3. Chat Component Integration

The `WhatsAppChat.tsx` component has been updated to:
- Listen for real-time message events
- Send messages via socket instead of HTTP requests
- Handle connection status updates
- Manage conversation room memberships

## Socket Events

### Backend → Frontend

| Event | Description | Data |
|-------|-------------|------|
| `authenticated` | User successfully authenticated | `{ userId, message, room }` |
| `auth_error` | Authentication failed | `{ message }` |
| `new_message` | New incoming message | `{ id, content, isOutgoing, ... }` |
| `message_sent` | Message sent confirmation | `{ messageId, to, message, ... }` |
| `message_sent_success` | Message delivery success | `{ messageId, timestamp }` |
| `message_send_error` | Message sending failed | `{ error }` |
| `whatsapp_status_update` | WhatsApp connection status | `{ connected, connectionState, ... }` |
| `connection_status` | Connection status response | `{ connected, connectionState, ... }` |
| `joined_conversation` | Joined conversation room | `{ conversationId, room }` |
| `left_conversation` | Left conversation room | `{ conversationId, room }` |

### Frontend → Backend

| Event | Description | Data |
|-------|-------------|------|
| `authenticate` | Authenticate user | `{ token, userId }` |
| `send_message` | Send WhatsApp message | `{ to, message, conversationId }` |
| `join_conversation` | Join conversation room | `{ conversationId }` |
| `leave_conversation` | Leave conversation room | `{ conversationId }` |
| `get_connection_status` | Request connection status | `{}` |

## Configuration

### Backend Configuration

1. **Install dependencies:**
```bash
cd whatsapp-erp
npm install socket.io
```

2. **Environment variables (optional):**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Frontend Configuration

1. **Environment variables:**
```env
# .env or .env.local
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

2. **API Configuration:**
The `API_CONFIG` in `src/lib/api/config.ts` automatically handles socket URL configuration for development and production.

## Usage Examples

### Sending a Message

```typescript
// Using the hook
const { sendWhatsAppMessage, lastError } = useWhatsAppSocket();

const handleSend = () => {
  const success = sendWhatsAppMessage('+1234567890', 'Hello!', 'conv_123');
  if (!success) {
    console.error('Failed to send:', lastError);
  }
};
```

### Listening for New Messages

```typescript
useEffect(() => {
  const handleNewMessage = (event: CustomEvent) => {
    const message = event.detail;
    console.log('New message:', message);
    // Update UI with new message
  };

  window.addEventListener('whatsapp:new_message', handleNewMessage);
  return () => window.removeEventListener('whatsapp:new_message', handleNewMessage);
}, []);
```

### Managing Conversations

```typescript
const { joinWhatsAppConversation, leaveWhatsAppConversation } = useWhatsAppSocket();

// When opening a chat
useEffect(() => {
  if (selectedConversationId) {
    joinWhatsAppConversation(selectedConversationId);
    return () => leaveWhatsAppConversation(selectedConversationId);
  }
}, [selectedConversationId]);
```

## Security Features

1. **JWT Authentication:** All socket connections require valid JWT tokens
2. **User Isolation:** Users can only access their own messages and rooms
3. **Room-based Access:** Conversation rooms ensure message privacy
4. **Origin Validation:** CORS configuration restricts allowed origins

## Error Handling

The implementation includes comprehensive error handling:

- **Connection errors:** Automatic reconnection attempts
- **Authentication errors:** Clear error messages and re-authentication flow
- **Message errors:** Error events for failed message delivery
- **Network errors:** Graceful fallbacks to HTTP requests when sockets fail

## Performance Considerations

1. **Efficient Room Management:** Users only join relevant rooms
2. **Event Batching:** Multiple socket events are handled efficiently
3. **Memory Management:** Proper cleanup of event listeners and connections
4. **Lazy Loading:** Socket service is loaded only when needed

## Monitoring and Debugging

### Backend Logs
The socket service provides detailed logging:
```javascript
logger.info(`User ${userId} authenticated and joined room ${userRoom}`);
logger.error('Authentication error:', error);
```

### Frontend Debug
Enable socket debugging in browser console:
```javascript
localStorage.debug = 'socket.io-client:socket';
```

## Deployment Notes

### Development
- Sockets run on the same port as the Express server (default: 5000)
- Hot reload is supported with nodemon configuration

### Production
- Ensure WebSocket support on your hosting platform
- Configure proper CORS origins for production domains
- Consider using Redis adapter for multiple server instances

## Troubleshooting

### Common Issues

1. **Socket not connecting:**
   - Check CORS configuration
   - Verify socket URL in frontend config
   - Ensure server is running with HTTP server (not just Express)

2. **Authentication failing:**
   - Verify JWT token is valid and not expired
   - Check if user exists in database
   - Confirm user ID matches token payload

3. **Messages not appearing:**
   - Check if user is in correct rooms
   - Verify event listeners are properly set up
   - Confirm WhatsApp service is connected

### Debug Commands

```javascript
// Frontend - Check socket status
console.log('Socket connected:', socket?.connected);
console.log('Socket authenticated:', isAuthenticated);

// Backend - Check active connections
console.log('Active connections:', socketService.getConnectedUsersCount());
```

## Future Enhancements

Potential improvements for the socket implementation:

1. **Message Persistence:** Store socket events for offline users
2. **File Sharing:** Extend socket support for media messages
3. **Typing Indicators:** Real-time typing status
4. **Read Receipts:** Message read confirmation
5. **Push Notifications:** Integration with browser push API
6. **Rate Limiting:** Prevent socket abuse
7. **Redis Adapter:** Support for horizontal scaling

This socket implementation provides a robust foundation for real-time WhatsApp messaging while maintaining security, performance, and scalability. 