# Supabase Setup Instructions

Follow these steps to set up your Supabase project and configure Google OAuth.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Organization**: Select or create one
   - **Name**: e.g., "island-mandarin"
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for the project to finish provisioning (~2 minutes)

## Step 2: Get Project Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Find these values:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon/public key**: Copy the `anon` `public` key

3. Copy these to your `.env.local` file (see `.env.example`)

## Step 3: Set Up Google OAuth

### 3.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "Island Mandarin Auth")
4. Click "Create"

### 3.2 Enable Google+ API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: External (unless you have a Google Workspace)
   - App name: "Island Mandarin"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue" through the scopes (no changes needed)
   - Add test users if needed
   - Click "Save and Continue"
4. Create OAuth client:
   - **Application type**: Web application
   - **Name**: "Island Mandarin Web"
   - **Authorized redirect URIs**: Add this exact URL:
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
     Replace `<project-ref>` with your actual Supabase project reference ID (found in your Project URL)
   - Click "Create"
5. Copy the **Client ID** and **Client Secret**

### 3.4 Configure Google Provider in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find "Google" and click to enable it
3. Paste:
   - **Client ID (for Google OAuth)**: Your Google Client ID
   - **Client Secret (for Google OAuth)**: Your Google Client Secret
4. Click "Save"

## Step 4: Configure Redirect URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://yourdomain.com
   ```
   (This is used as a fallback when redirectTo doesn't match allowed URLs)

3. Add **Redirect URLs** (one per line):
   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   http://localhost:3002
   http://localhost:3002/auth/callback
   https://yourdomain.com
   https://yourdomain.com/auth/callback
   ```
   
   **IMPORTANT**: 
   - Add **ALL ports** you use for local development (3000, 3002, etc.)
   - If your `redirectTo` URL is not in this list, Supabase will **ignore it** and redirect to the Site URL instead
   - The middleware will catch these cases and fix the redirect, but it's better to add all ports upfront

## Step 5: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `supabase/schema.sql`
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. Verify tables were created by checking **Table Editor**

## Step 6: Verify Setup

1. Confirm tables exist: `user_profiles` and `topic_islands`
2. Confirm RLS is enabled (should see lock icon in Table Editor)
3. Test Google OAuth flow:
   - Start your Next.js app: `npm run dev`
   - Navigate to `/login`
   - Click "Continue with Google"
   - Should redirect to Google, then back to `/auth/callback`, then to `/app`

## Troubleshooting

- **"Redirect URI mismatch"**: Ensure the redirect URL in Google Cloud Console exactly matches: `https://<project-ref>.supabase.co/auth/v1/callback`
- **"Invalid credentials"**: Double-check Client ID and Secret are pasted correctly in Supabase
- **RLS blocking queries**: Ensure you're authenticated when testing, and policies are correctly set up

