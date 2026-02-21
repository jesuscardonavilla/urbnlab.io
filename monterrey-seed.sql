-- ============================================================
-- MONTERREY CAMPAIGN SETUP
-- ============================================================
-- This script will use the existing Monterrey org if it exists,
-- or create a new one if it doesn't.

-- 1. Get or create Monterrey org ID
DO $$
DECLARE
  monterrey_org_id UUID;
  monterrey_boundary_id UUID := 'b2000000-0000-0000-0000-000000000001';
  monterrey_campaign_id UUID := 'c2000000-0000-0000-0000-000000000001';
BEGIN
  -- Get existing Monterrey org ID or create new one
  INSERT INTO orgs (id, name, slug)
  VALUES (
    'a2000000-0000-0000-0000-000000000001',
    'Monterrey',
    'monterrey'
  )
  ON CONFLICT (slug)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO monterrey_org_id;

  -- If the above didn't return an ID, fetch it
  IF monterrey_org_id IS NULL THEN
    SELECT id INTO monterrey_org_id FROM orgs WHERE slug = 'monterrey';
  END IF;

  -- Create or update boundary
  INSERT INTO boundaries (id, org_id, name, geog, center_lat, center_lng, default_zoom)
  VALUES (
    monterrey_boundary_id,
    monterrey_org_id,
    'Centro de Monterrey',
    ST_GeographyFromText('SRID=4326;POLYGON((-100.35 25.66, -100.29 25.66, -100.29 25.71, -100.35 25.71, -100.35 25.66))'),
    25.6866,
    -100.3161,
    13
  )
  ON CONFLICT (id)
  DO UPDATE SET
    org_id = EXCLUDED.org_id,
    name = EXCLUDED.name,
    geog = EXCLUDED.geog,
    center_lat = EXCLUDED.center_lat,
    center_lng = EXCLUDED.center_lng,
    default_zoom = EXCLUDED.default_zoom;

  -- Back-fill geog_json
  UPDATE boundaries
  SET geog_json = ST_AsGeoJSON(geog)::text
  WHERE id = monterrey_boundary_id AND geog_json IS NULL;

  -- Create or update campaign
  INSERT INTO campaigns (id, org_id, boundary_id, title, description, start_at, end_at, enabled_categories)
  VALUES (
    monterrey_campaign_id,
    monterrey_org_id,
    monterrey_boundary_id,
    'Centro Urbano',
    'Identifica problemas de movilidad en Monterrey para mejorar la infraestructura del centro urbano.',
    now() - INTERVAL '5 days',
    now() + INTERVAL '52 days',
    ARRAY['crosswalk_needed','bike_gap','sidewalk_ada','speeding_near_miss','tourism_pressure','climate_stress']
  )
  ON CONFLICT (id)
  DO UPDATE SET
    org_id = EXCLUDED.org_id,
    boundary_id = EXCLUDED.boundary_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    enabled_categories = EXCLUDED.enabled_categories;

  -- Output the org ID being used
  RAISE NOTICE 'Using Monterrey org ID: %', monterrey_org_id;
END $$;
