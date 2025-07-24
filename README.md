# WhatsApp ERP - Multi-User Node.js Backend

A scalable WhatsApp ERP system that allows multiple users to connect their own WhatsApp accounts for business operations.

## 🚀 Features

### Multi-User WhatsApp Integration
- **Individual WhatsApp Connections**: Each user can connect their own WhatsApp account
- **Persistent Sessions**: Database-based auth storage compatible with Vercel deployment
- **Contact Management**: Messages are only stored from contacts in your database
- **Conversation Management**: Per-user conversation tracking and history
- **Automatic Session Cleanup**: Monitors and cleans up stale connections

### ERP Functionality
- **Product Catalog Management**: Manage products and categories
- **Order Processing**: Accept orders via WhatsApp with automated responses
- **User Authentication**: JWT-based authentication for secure access
- **Role-based Access**: Admin, manager, employee, and customer roles

### Bot Features (Per User)
- Product catalog browsing via WhatsApp
- Order placement and tracking through chat
- Automated customer responses
- Real-time order status updates

## 📋 Prerequisites

- Node.js (>= 18.0.0)
- PostgreSQL database
- WhatsApp account(s) for business use

## 🛠️ Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/whatsapp-erp.git
cd whatsapp-erp
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/whatsapp_erp

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# WhatsApp Configuration
MAX_RECONNECT_ATTEMPTS=5
RECONNECT_INTERVAL=5000

# Session Cleanup Configuration
SESSION_CLEANUP_INTERVAL=300000  # 5 minutes
STALE_CONNECTION_TIMEOUT=1800000 # 30 minutes

# Logging Configuration
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# File Upload Configuration
MAX_FILE_SIZE=10mb
```

### 4. Set Up Database
The application will automatically create and sync database tables on startup.

### 5. Run the Server
```bash
# Development
npm run dev

# Production
npm start
```

The server will start at `http://localhost:5000`

## 📱 Multi-User WhatsApp Setup

### For Each User:

1. **Create Account**
   ```bash
   POST /api/auth/signup
   {
     "email": "user@company.com",
     "password": "securepassword",
     "role": "admin" // or "manager", "employee"
   }
   ```

2. **Login**
   ```bash
   POST /api/auth/login
   {
     "email": "user@company.com",
     "password": "securepassword"
   }
   ```

3. **Connect WhatsApp**
   ```bash
   POST /api/whatsapp/connect
   # Headers: Authorization: Bearer <jwt_token>
   ```

4. **Get QR Code**
   - Visit: `GET /api/whatsapp/qr` (Server-Sent Events)
   - Scan QR code with WhatsApp mobile app

5. **Add Contacts** (to enable message storage)
   ```bash
   POST /api/whatsapp/contact/add
   {
     "phoneNumber": "+1234567890",
     "name": "Customer Name"
   }
   ```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (requires auth)

### WhatsApp Management
- `POST /api/whatsapp/connect` - Connect user's WhatsApp
- `POST /api/whatsapp/disconnect` - Disconnect user's WhatsApp
- `GET /api/whatsapp/status` - Check connection status
- `GET /api/whatsapp/qr` - Get QR code (SSE)

### Messaging
- `POST /api/whatsapp/send-message` - Send message
- `POST /api/whatsapp/send-catalog` - Send product catalog

### Conversations & Contacts
- `GET /api/whatsapp/conversations` - Get user's conversations
- `GET /api/whatsapp/conversations/:id/messages` - Get conversation messages
- `GET /api/whatsapp/contacts` - Get contact list
- `POST /api/whatsapp/contact/add` - Add contact

### Products & Categories
- `GET /api/products` - List products
- `POST /api/products` - Create product (requires auth)
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (requires auth)

### Admin
- `GET /api/whatsapp/sessions/active` - Active sessions (admin only)
- `GET /api/admin/cleanup-stats` - Session cleanup statistics (admin only)

## 🤖 WhatsApp Bot Commands

Customers can interact with your WhatsApp bot using these commands:

- `catalog` or `products` - View product catalog
- `ORDER [Product]:[Quantity]` - Place an order
  - Example: `ORDER Gaming Laptop:1`
- `status` or `my order` - Check order status
- `hello` or `hi` - Get welcome message
- `help` - Show available commands
- `contact` - Get contact information

## 📊 Features Comparison

| Feature | Single User (Old) | Multi-User (New) |
|---------|------------------|------------------|
| WhatsApp Connections | 1 shared connection | Multiple user connections |
| Auth Storage | File-based | Database-based |
| Message Storage | All messages | Only from known contacts |
| Conversation Management | Global | Per-user |
| QR Code Access | Public endpoint | Authenticated per user |
| Session Management | Manual | Automatic cleanup |
| Vercel Compatibility | Limited | Full support |

## 🚀 Deployment

### Vercel Deployment

1. **Database Setup**: Use services like [Supabase](https://supabase.com), [Neon](https://neon.tech), or [Railway](https://railway.app)

2. **Environment Variables**: Set all required environment variables in Vercel dashboard

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Traditional Hosting

1. Set up PostgreSQL database
2. Configure environment variables
3. Run `npm start`

## 🔧 Configuration

### Session Cleanup
- `SESSION_CLEANUP_INTERVAL`: How often to check for stale sessions (default: 5 minutes)
- `STALE_CONNECTION_TIMEOUT`: When to consider a session stale (default: 30 minutes)

### WhatsApp Connection
- `MAX_RECONNECT_ATTEMPTS`: Maximum reconnection attempts (default: 5)
- `RECONNECT_INTERVAL`: Time between reconnection attempts (default: 5 seconds)

## 🛡️ Security

- JWT authentication for all WhatsApp endpoints
- Role-based access control
- Contact whitelist for message storage
- Database-based session management
- Secure environment variable handling

## 📈 Monitoring

Monitor your system using:
- `GET /health` - System health check
- `GET /api/admin/cleanup-stats` - Session cleanup statistics
- Application logs for connection status and errors

## 🔍 Troubleshooting

### Common Issues

1. **WhatsApp Connection Fails**
   - Check QR code expiration
   - Verify WhatsApp mobile app is connected to internet
   - Check database connectivity

2. **Messages Not Stored**
   - Ensure sender is added as contact via `/api/whatsapp/contact/add`
   - Check user's WhatsApp connection status

3. **Database Connection Issues**
   - Verify `DATABASE_URL` format
   - Check database server accessibility
   - Ensure database exists and user has permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation at `http://localhost:5000/`

---

**Note**: This is a multi-user system. Each user must authenticate and connect their own WhatsApp account. Messages are only stored from contacts that exist in your database, ensuring privacy and data management compliance.

