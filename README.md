# UrbnLab.io

Community-powered city improvement platform — B2B SaaS for cities, counties, and townships.

## Quick start

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Note your **Project URL** and **anon key** from Settings → API.

### 2. Enable PostGIS

In your Supabase dashboard:
1. Go to **Database → Extensions**.
2. Search for `postgis` and enable it.

### 3. Run the schema

1. Go to **SQL Editor** in your Supabase dashboard.
2. Open `supabase/schema.sql` from this repo.
3. Paste the entire file and click **Run**.

This creates all tables, indexes, RLS policies, the profile-creation trigger, and seed data for the Traverse City demo org.

### 4. Create the pin-photos storage bucket

1. Go to **Storage** in your Supabase dashboard.
2. Click **New bucket**.
3. Name: `pin-photos` — set **Public** to ON.
4. Under bucket **Policies**, add a policy:
   - **For INSERT** — Authenticated users can upload to their own folder:
     ```sql
     (auth.uid()::text = (storage.foldername(name))[1])
     ```

### 5. Create a Mapbox token

1. Go to [account.mapbox.com](https://account.mapbox.com).
2. Create a public token (default scopes are fine).

### 6. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### 7. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Making yourself an admin

After signing up (visit `/auth/login`, enter your email, click the magic link), run this in the Supabase SQL Editor:

```sql
-- Replace YOUR_EMAIL with your actual email
INSERT INTO org_memberships (org_id, user_id, role)
SELECT
  'a1000000-0000-0000-0000-000000000001' AS org_id,
  p.id AS user_id,
  'admin' AS role
FROM profiles p
WHERE p.email = 'YOUR_EMAIL'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
```

Then visit `/o/traverse-city/admin` to access the admin dashboard.

---

## Demo

After running locally, visit: http://localhost:3000/o/traverse-city

---

## Replacing the demo boundary polygon

The seed data uses a simple bounding box rectangle. To use a real polygon:

1. Go to https://geojson.io
2. Draw your boundary polygon.
3. Copy just the `Polygon` geometry (the `geometry` field inside the Feature).
4. In the admin dashboard: Boundaries tab → Edit → paste the GeoJSON.

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home / landing page |
| `/auth/login` | Sign in with magic link |
| `/o/[slug]` | Org landing page |
| `/o/[slug]/c/[id]` | Campaign map page |
| `/o/[slug]/c/[id]/add` | Add a pin |
| `/o/[slug]/c/[id]/pin/[id]` | Pin detail + comments |
| `/o/[slug]/admin` | Admin dashboard |
| `/api/export?org=&type=` | CSV export API |

---

## Export API

```
GET /api/export?org={orgId}&type={type}&campaign={campaignId}
```

`type` values: `campaigns`, `pins`, `votes`, `comments`

`campaign` param is optional — filters results to that campaign.

Only accessible by org admins. Returns CSV download.

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** (v4)
- **Mapbox GL JS**
- **Supabase** (Auth, Postgres + PostGIS, Storage)

---

## Adding a new org (MVP)

For MVP, create orgs directly in the Supabase SQL Editor:

```sql
INSERT INTO orgs (name, slug) VALUES ('Your City Name', 'your-city-slug');
```

Then make yourself admin using the new org's ID.
