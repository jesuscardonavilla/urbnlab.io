-- ============================================================
-- MONTERREY ORG, BOUNDARY, AND CAMPAIGN
-- ============================================================

-- 1. Create Monterrey Organization
INSERT INTO orgs (id, name, slug)
VALUES (
  'a2000000-0000-0000-0000-000000000001',
  'Monterrey',
  'monterrey'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Create Monterrey Boundary (Downtown Monterrey bounding box)
INSERT INTO boundaries (id, org_id, name, geog, center_lat, center_lng, default_zoom)
VALUES (
  'b2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'Centro de Monterrey',
  ST_GeographyFromText('SRID=4326;POLYGON((-100.35 25.66, -100.29 25.66, -100.29 25.71, -100.35 25.71, -100.35 25.66))'),
  25.6866,
  -100.3161,
  13
) ON CONFLICT DO NOTHING;

-- 3. Back-fill geog_json for Monterrey boundary
UPDATE boundaries SET geog_json = ST_AsGeoJSON(geog)::text WHERE geog_json IS NULL;

-- 4. Create Monterrey Campaign
INSERT INTO campaigns (id, org_id, boundary_id, title, description, start_at, end_at, enabled_categories)
VALUES (
  'c2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000001',
  'Centro Urbano',
  'Identifica problemas de movilidad en Monterrey para mejorar la infraestructura del centro urbano.',
  now() - INTERVAL '5 days',
  now() + INTERVAL '52 days',
  ARRAY['crosswalk_needed','bike_gap','sidewalk_ada','speeding_near_miss','tourism_pressure','climate_stress']
) ON CONFLICT DO NOTHING;
