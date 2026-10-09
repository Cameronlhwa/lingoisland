# Lingo Island

Lingo Island is a Mandarin learning product for A2–B2 learners, focused on vocabulary retention through topic islands, daily review, and AI conversation practice.

## Tech Stack

- Next.js 16 (App Router), React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Postgres + Auth)
- Google OAuth

## Getting Started

Project guides and implementation notes are in [docs/](./docs/).

### 1. Install Dependencies

Use Node.js 24, as specified in `package.json`.

```bash
npm install
```

### 2. Set Up Supabase

1. Follow the detailed instructions in [`supabase/README.md`](./supabase/README.md) to:
   - Create a Supabase project
   - Enable Google OAuth
   - Run the database schema

2. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in your Supabase credentials in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL from Supabase dashboard
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) For server-side admin operations

### 3. Run Database Schema

In your Supabase dashboard, go to SQL Editor and run the contents of `supabase/schema.sql` to create the necessary tables and RLS policies.

### 4. Start Development Server

```bash
npm run dev
```

5. Open [http://localhost:3002](http://localhost:3002) in your browser.

### Verify Changes

```bash
npm run typecheck
npm run lint
npm run test:learn-level
npm run build
```

### Dependency Updates

Dependabot checks npm dependencies every Monday at 9:00 AM Toronto time using
`.github/dependabot.yml`. Next.js/React and Tailwind packages are updated in
separate framework groups, including major upgrades. Other minor/patch updates
are grouped by production and development dependencies; other major upgrades
get individual PRs. Review and run the verification commands above before merging.

Version updates start once this configuration is merged into the repository's
default branch. Dependabot alerts and automatic security updates are managed
separately in GitHub's repository security settings.

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                # Landing page
│   ├── login/                  # Login page with Google OAuth
│   ├── auth/callback/          # OAuth callback handler
│   ├── onboarding/topic-island/ # 3-step onboarding wizard
│   ├── app/                    # Main app interface (protected)
│   └── globals.css             # Global styles and Tailwind imports
├── components/
│   └── landing/                # Landing page components
├── lib/
│   └── supabase/
│       ├── browser.ts          # Browser-side Supabase client
│       └── server.ts           # Server-side Supabase client
├── supabase/
│   ├── README.md               # Supabase setup instructions
│   ├── schema.sql              # Database schema with RLS policies
│   └── seed.sql                # Optional seed data
├── middleware.ts               # Route protection middleware
└── package.json
```

## Design Philosophy

- Minimal, editorial aesthetic
- Lots of whitespace
- Strong typographic hierarchy (serif italic for emphasis, bold sans for headlines)
- Bordered boxes with subtle hover states
- Mostly monochrome with minimal color accents
- Fully responsive

## Customization

All components are in `/components/landing/` and can be easily edited. The brand name "Island Mandarin" is used as a placeholder throughout and can be changed via search and replace.
