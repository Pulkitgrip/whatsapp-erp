# Whatsapp-ERP Node.js Backend

## Features
- User signup and login with JWT authentication
- PostgreSQL database connection

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/yourdbname
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

3. **Set up the database:**
   Create a `users` table in your PostgreSQL database:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username VARCHAR(255) UNIQUE NOT NULL,
     password VARCHAR(255) NOT NULL
   );
   ```

4. **Run the server:**
   ```bash
   npm run dev
   ```
   or
   ```bash
   node src/index.js
   ```

## API Endpoints

- `POST /api/auth/signup` — Register a new user
- `POST /api/auth/login` — Login and receive a JWT token

