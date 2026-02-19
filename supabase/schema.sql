-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. ORGS
-- ============================================================
CREATE TABLE IF NOT EXISTS orgs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ORG MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_memberships (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ============================================================
-- 4. BOUNDARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS boundaries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  name          TEXT NOT NULL,
  geog          GEOGRAPHY(POLYGON, 4326) NOT NULL,
  geog_json     TEXT,
  center_lat    DOUBLE PRECISION,
  center_lng    DOUBLE PRECISION,
  default_zoom  INT DEFAULT 12,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boundaries_org_id_idx ON boundaries (org_id);
CREATE INDEX IF NOT EXISTS boundaries_geog_idx ON boundaries USING GIST (geog);

-- Auto-sync geog_json on insert/update
CREATE OR REPLACE FUNCTION sync_boundary_geog_json()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geog_json = ST_AsGeoJSON(NEW.geog)::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_boundary_upsert ON boundaries;
CREATE TRIGGER before_boundary_upsert
  BEFORE INSERT OR UPDATE ON boundaries
  FOR EACH ROW EXECUTE FUNCTION sync_boundary_geog_json();

-- ============================================================
-- 5. CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  boundary_id         UUID NOT NULL REFERENCES boundaries ON DELETE RESTRICT,
  title               TEXT NOT NULL,
  description         TEXT,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  enabled_categories  TEXT[] DEFAULT '{}',
  created_by          UUID REFERENCES profiles,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_org_id_idx ON campaigns (org_id);
CREATE INDEX IF NOT EXISTS campaigns_boundary_id_idx ON campaigns (boundary_id);

-- ============================================================
-- 6. PINS
-- ============================================================
CREATE TABLE IF NOT EXISTS pins (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  campaign_id       UUID NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  boundary_id       UUID NOT NULL REFERENCES boundaries ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  category          TEXT NOT NULL CHECK (category IN (
    'crosswalk_needed','bike_gap','sidewalk_ada',
    'speeding_near_miss','tourism_pressure','climate_stress'
  )),
  severity          INT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  time_pattern      TEXT NOT NULL CHECK (time_pattern IN (
    'always','weekdays','weekends','nights','mornings','summer_peak','winter_peak'
  )),
  impacted_groups   TEXT[] DEFAULT '{}',
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  photo_url         TEXT,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  geog              GEOGRAPHY(POINT, 4326) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','reviewing','planned','in_progress','completed','closed_not_feasible'
  )),
  is_hidden         BOOLEAN NOT NULL DEFAULT false,
  canonical_pin_id  UUID REFERENCES pins (id),
  merged_reason     TEXT
);

CREATE INDEX IF NOT EXISTS pins_campaign_id_idx ON pins (campaign_id);
CREATE INDEX IF NOT EXISTS pins_org_id_idx ON pins (org_id);
CREATE INDEX IF NOT EXISTS pins_geog_idx ON pins USING GIST (geog);
CREATE INDEX IF NOT EXISTS pins_canonical_idx ON pins (canonical_pin_id);

-- Validate pin on insert
CREATE OR REPLACE FUNCTION validate_pin_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign RECORD;
  v_boundary RECORD;
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = NEW.campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  IF NOT (now() BETWEEN v_campaign.start_at AND v_campaign.end_at) THEN
    RAISE EXCEPTION 'Campaign is not currently active';
  END IF;
  IF v_campaign.org_id <> NEW.org_id THEN
    RAISE EXCEPTION 'Pin org_id does not match campaign org_id';
  END IF;
  IF v_campaign.boundary_id <> NEW.boundary_id THEN
    RAISE EXCEPTION 'Pin boundary_id does not match campaign boundary_id';
  END IF;
  SELECT * INTO v_boundary FROM boundaries WHERE id = NEW.boundary_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boundary not found'; END IF;
  IF NOT ST_Covers(v_boundary.geog::geometry, NEW.geog::geometry) THEN
    RAISE EXCEPTION 'Pin location is outside the campaign boundary.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_pin_insert ON pins;
CREATE TRIGGER before_pin_insert
  BEFORE INSERT ON pins
  FOR EACH ROW EXECUTE FUNCTION validate_pin_insert();

-- ============================================================
-- 7. VOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  pin_id      UUID NOT NULL REFERENCES pins ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pin_id, user_id)
);

CREATE INDEX IF NOT EXISTS votes_pin_id_idx ON votes (pin_id);
CREATE INDEX IF NOT EXISTS votes_org_id_idx ON votes (org_id);

-- ============================================================
-- 8. COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  pin_id      UUID NOT NULL REFERENCES pins ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  body        TEXT NOT NULL,
  is_hidden   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS comments_pin_id_idx ON comments (pin_id);
CREATE INDEX IF NOT EXISTS comments_org_id_idx ON comments (org_id);

-- ============================================================
-- 9. ADMIN ACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES orgs ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  action_type   TEXT NOT NULL,
  target_table  TEXT NOT NULL,
  target_id     UUID,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_actions_org_id_idx ON admin_actions (org_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "orgs_select" ON orgs FOR SELECT USING (true);
CREATE POLICY "orgs_insert" ON orgs FOR INSERT WITH CHECK (true);

CREATE POLICY "memberships_select" ON org_memberships FOR SELECT USING (true);
CREATE POLICY "memberships_insert" ON org_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memberships_delete" ON org_memberships FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "boundaries_select" ON boundaries FOR SELECT USING (true);
CREATE POLICY "boundaries_write" ON boundaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = boundaries.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_write" ON campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = campaigns.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "pins_select_public" ON pins FOR SELECT
  USING (is_hidden = false AND canonical_pin_id IS NULL);
CREATE POLICY "pins_select_admin" ON pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "pins_insert" ON pins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "pins_update_admin" ON pins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = votes.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comments_select_public" ON comments FOR SELECT USING (is_hidden = false);
CREATE POLICY "comments_select_admin" ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "comments_update_admin" ON comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_actions_select" ON admin_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = admin_actions.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "admin_actions_insert" ON admin_actions FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = admin_actions.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO orgs (id, name, slug)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Traverse City',
  'traverse-city'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO boundaries (id, org_id, name, geog, center_lat, center_lng, default_zoom)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Traverse City (MVP bbox)',
  ST_GeographyFromText('SRID=4326;POLYGON((-85.65 44.74, -85.59 44.74, -85.59 44.79, -85.65 44.79, -85.65 44.74))'),
  44.765,
  -85.620,
  13
) ON CONFLICT DO NOTHING;

-- Back-fill geog_json for the seeded boundary
UPDATE boundaries SET geog_json = ST_AsGeoJSON(geog)::text WHERE geog_json IS NULL;

INSERT INTO campaigns (id, org_id, boundary_id, title, description, start_at, end_at, enabled_categories)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'Spring Mobility Fixes',
  'Help us identify mobility issues across Traverse City for our spring 2026 infrastructure plan.',
  now() - INTERVAL '7 days',
  now() + INTERVAL '60 days',
  ARRAY['crosswalk_needed','bike_gap','sidewalk_ada','speeding_near_miss','tourism_pressure','climate_stress']
) ON CONFLICT DO NOTHING;

-- ============================================================
-- FIND YOUR USER ID (run this separately after the above)
-- ============================================================
-- SELECT id, email FROM auth.users;
-- ============================================================
-- DROP EXISTING POLICIES (safe to re-run)
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "orgs_select" ON orgs;
DROP POLICY IF EXISTS "orgs_insert" ON orgs;
DROP POLICY IF EXISTS "memberships_select" ON org_memberships;
DROP POLICY IF EXISTS "memberships_insert" ON org_memberships;
DROP POLICY IF EXISTS "memberships_delete" ON org_memberships;
DROP POLICY IF EXISTS "boundaries_select" ON boundaries;
DROP POLICY IF EXISTS "boundaries_write" ON boundaries;
DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
DROP POLICY IF EXISTS "campaigns_write" ON campaigns;
DROP POLICY IF EXISTS "pins_select_public" ON pins;
DROP POLICY IF EXISTS "pins_select_admin" ON pins;
DROP POLICY IF EXISTS "pins_insert" ON pins;
DROP POLICY IF EXISTS "pins_update_admin" ON pins;
DROP POLICY IF EXISTS "votes_select" ON votes;
DROP POLICY IF EXISTS "votes_insert" ON votes;
DROP POLICY IF EXISTS "votes_delete" ON votes;
DROP POLICY IF EXISTS "comments_select_public" ON comments;
DROP POLICY IF EXISTS "comments_select_admin" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update_admin" ON comments;
DROP POLICY IF EXISTS "admin_actions_select" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_insert" ON admin_actions;

-- ============================================================
-- ADD geog_json COLUMN (if not already there)
-- ============================================================
ALTER TABLE boundaries ADD COLUMN IF NOT EXISTS geog_json TEXT;

-- Sync function + trigger
CREATE OR REPLACE FUNCTION sync_boundary_geog_json()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geog_json = ST_AsGeoJSON(NEW.geog)::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_boundary_upsert ON boundaries;
CREATE TRIGGER before_boundary_upsert
  BEFORE INSERT OR UPDATE ON boundaries
  FOR EACH ROW EXECUTE FUNCTION sync_boundary_geog_json();

-- Back-fill existing rows
UPDATE boundaries SET geog_json = ST_AsGeoJSON(geog)::text WHERE geog_json IS NULL;

-- ============================================================
-- RECREATE RLS POLICIES
-- ============================================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "orgs_select" ON orgs FOR SELECT USING (true);
CREATE POLICY "orgs_insert" ON orgs FOR INSERT WITH CHECK (true);

CREATE POLICY "memberships_select" ON org_memberships FOR SELECT USING (true);
CREATE POLICY "memberships_insert" ON org_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memberships_delete" ON org_memberships FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "boundaries_select" ON boundaries FOR SELECT USING (true);
CREATE POLICY "boundaries_write" ON boundaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = boundaries.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (true);
CREATE POLICY "campaigns_write" ON campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = campaigns.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "pins_select_public" ON pins FOR SELECT
  USING (is_hidden = false AND canonical_pin_id IS NULL);
CREATE POLICY "pins_select_admin" ON pins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "pins_insert" ON pins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "pins_update_admin" ON pins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = pins.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = votes.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comments_select_public" ON comments FOR SELECT USING (is_hidden = false);
CREATE POLICY "comments_select_admin" ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "comments_update_admin" ON comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = comments.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_actions_select" ON admin_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = admin_actions.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "admin_actions_insert" ON admin_actions FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id
    AND EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = admin_actions.org_id AND user_id = auth.uid() AND role = 'admin'
    )
  );
