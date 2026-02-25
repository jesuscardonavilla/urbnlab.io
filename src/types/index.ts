// UrbanMaps.io shared TypeScript types

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: "member" | "admin";
  created_at: string;
}

export interface Boundary {
  id: string;
  org_id: string;
  name: string;
  geog: unknown;      // PostGIS WKB — do not use for display
  geog_json: string;  // GeoJSON string — use this for maps
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  boundary_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_active?: boolean; // computed in app: now() between start_at and end_at
  enabled_categories: PinCategory[];
  created_by: string;
  created_at: string;
  // joined
  boundary?: Boundary;
}

export type PinCategory =
  | "crosswalk_needed"
  | "sidewalk_ada"
  | "bus_stop_needed"
  | "bike_lane_needed"
  | "traffic_signal"
  | "street_maintenance"
  | "tourism_pressure"
  | "climate_stress";

export type PinStatus =
  | "new"
  | "reviewing"
  | "planned"
  | "in_progress"
  | "completed"
  | "closed_not_feasible";

export type TimePattern =
  | "always"
  | "weekdays"
  | "weekends"
  | "nights"
  | "mornings"
  | "summer_peak"
  | "winter_peak";

export type ImpactedGroup =
  | "pedestrians"
  | "cyclists"
  | "kids"
  | "seniors"
  | "wheelchair_ada"
  | "residents"
  | "visitors"
  | "drivers"
  | "transit_users";

export interface Pin {
  id: string;
  org_id: string;
  campaign_id: string;
  boundary_id: string;
  user_id: string;
  created_at: string;
  category: PinCategory;
  severity: number;
  time_pattern: TimePattern;
  impacted_groups: ImpactedGroup[];
  title: string;
  description: string;
  photo_url: string | null;
  lat: number;
  lng: number;
  status: PinStatus;
  is_hidden: boolean;
  canonical_pin_id: string | null;
  merged_reason: string | null;
  // joined fields
  vote_count?: number;
  comment_count?: number;
  profile?: Profile;
}

export interface Vote {
  id: string;
  org_id: string;
  pin_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  org_id: string;
  pin_id: string;
  user_id: string;
  created_at: string;
  body: string;
  is_hidden: boolean;
  profile?: Profile;
}

export interface AdminAction {
  id: string;
  org_id: string;
  actor_id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Category metadata for UI
export const CATEGORY_LABELS: Record<PinCategory, string> = {
  crosswalk_needed: "Crosswalk Needed",
  sidewalk_ada: "Sidewalk / ADA",
  bus_stop_needed: "Bus Stop Needed",
  bike_lane_needed: "Bike Lane Needed",
  traffic_signal: "Traffic Signal Issue",
  street_maintenance: "Street Maintenance",
  tourism_pressure: "Tourism Pressure",
  climate_stress: "Climate Stress",
};

export const CATEGORY_GROUPS: { label: string; categories: PinCategory[] }[] = [
  { label: "Pedestrians", categories: ["crosswalk_needed", "sidewalk_ada", "bus_stop_needed"] },
  { label: "Cyclists", categories: ["bike_lane_needed"] },
  { label: "Road / Traffic", categories: ["traffic_signal", "street_maintenance"] },
  { label: "General", categories: ["tourism_pressure", "climate_stress"] },
];

export const CATEGORY_COLORS: Record<PinCategory, string> = {
  crosswalk_needed: "#3B82F6",
  sidewalk_ada: "#F59E0B",
  bus_stop_needed: "#6366F1",
  bike_lane_needed: "#10B981",
  traffic_signal: "#EF4444",
  street_maintenance: "#F97316",
  tourism_pressure: "#8B5CF6",
  climate_stress: "#06B6D4",
};

export const STATUS_LABELS: Record<PinStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  closed_not_feasible: "Closed – Not Feasible",
};

export const TIME_PATTERN_LABELS: Record<TimePattern, string> = {
  always: "Always",
  weekdays: "Weekdays",
  weekends: "Weekends",
  nights: "Nights",
  mornings: "Mornings",
  summer_peak: "Summer Peak",
  winter_peak: "Winter Peak",
};

export const IMPACTED_GROUP_LABELS: Record<ImpactedGroup, string> = {
  pedestrians: "Pedestrians",
  cyclists: "Cyclists",
  kids: "Kids",
  seniors: "Seniors",
  wheelchair_ada: "Wheelchair / ADA",
  residents: "Residents",
  visitors: "Visitors",
  drivers: "Drivers",
  transit_users: "Transit Users",
};
