# Deployment Guide - WhatsApp ERP to Vercel

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Database**: Set up a PostgreSQL database (you can use services like Supabase, Railway, or Neon)

## Step 1: Prepare Your Database

1. Set up a PostgreSQL database
2. Note down your database credentials:
   - Host
   - Port (usually 5432)
   - Database name
   - Username
   - Password

## Step 2: Deploy to Vercel

### Option A: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy your project:
   ```bash
   vercel
   ```

### Option B: Using Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project settings

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

```
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=24h
NODE_ENV=production
```

## Step 4: Deploy

1. Push your changes to GitHub
2. Vercel will automatically deploy your application
3. Your app will be available at: `https://your-project-name.vercel.app`

## Important Notes

- **Database**: Make sure your database is accessible from Vercel's servers
- **Environment Variables**: Never commit sensitive information to your repository
- **CORS**: Your application already has CORS configured
- **Port**: Vercel will automatically set the PORT environment variable

## Troubleshooting

1. **Database Connection Issues**: Ensure your database allows external connections
2. **Environment Variables**: Double-check all environment variables are set correctly
3. **Build Errors**: Check the build logs in Vercel dashboard

## API Endpoints

Your API will be available at:
- Base URL: `https://your-project-name.vercel.app/api`
- Auth endpoints: `https://your-project-name.vercel.app/api/auth/*`

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connectivity 