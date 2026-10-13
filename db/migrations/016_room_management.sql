-- =====================================================================
-- 016 — Room Management (individual rooms, beds, assets, inventory)
--
-- NON-DESTRUCTIVE and IDEMPOTENT: safe to run more than once.
-- Run in Supabase Dashboard -> SQL Editor (paste the whole file), or let the server apply it
-- at start-up (the same statements are appended to db/schema.sql).
--
-- Builds on 012 (properties, property_rooms, property_assets, placements).
--
--   property_rooms           + room details: bathroom, accessibility, cleaning, inspection, void/blocked
--   room_beds                individual bed spaces in a room
--   placements               + bed_id (which bed a resident has)
--   property_assets          + tracked-asset details: tag, make/model, PAT/service dates, cost
--   inventory_items          item catalogue (shared by all properties)
--   property_inventory_stock COMMON inventory: stock held at each property (the store room)
--   room_inventory           items placed IN a room (issued from the common stock or added directly)
--   inventory_movements      ledger: issue to room, return to stock, transfer, damaged, lost, purchase...
--   room_kit_templates       standard room kits (e.g. "Standard single") applied to rooms in one click
--   room_issues              defects / repairs / hazards raised against a room
--   room_activity_log        timeline of everything that happens in a room
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Extend property_rooms
-- ---------------------------------------------------------------------
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS bathroom_type TEXT DEFAULT 'En-suite';
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS accessibility_features TEXT;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN DEFAULT false;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS is_family_room BOOLEAN DEFAULT false;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT 'None';
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS cleaning_status TEXT DEFAULT 'Clean';
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMPTZ;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS last_inspected_at TIMESTAMPTZ;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS next_inspection_due DATE;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS key_reference TEXT;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS blocked_until DATE;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS void_since DATE;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS fire_safety_notes TEXT;
ALTER TABLE public.property_rooms ADD COLUMN IF NOT EXISTS kit_template_id TEXT;

CREATE INDEX IF NOT EXISTS idx_property_rooms_cleaning ON public.property_rooms(cleaning_status);

-- ---------------------------------------------------------------------
-- B. Extend property_assets (individually tracked equipment)
-- ---------------------------------------------------------------------
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS asset_tag TEXT;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12,2);
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS last_service_date DATE;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS next_service_due DATE;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS pat_test_date DATE;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS pat_next_due DATE;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS location_detail TEXT;

CREATE INDEX IF NOT EXISTS idx_property_assets_tag ON public.property_assets(asset_tag);

-- ---------------------------------------------------------------------
-- C. Beds
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_beds (
  id TEXT PRIMARY KEY,
  bed_reference TEXT,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES public.property_rooms(id) ON DELETE CASCADE,
  bed_label TEXT NOT NULL,
  bed_type TEXT DEFAULT 'Single',
  status TEXT DEFAULT 'Available',            -- Available | Out of Service (occupancy comes from placements.bed_id)
  mattress_condition TEXT DEFAULT 'Good',
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, bed_label)
);
CREATE INDEX IF NOT EXISTS idx_room_beds_room ON public.room_beds(room_id);
CREATE INDEX IF NOT EXISTS idx_room_beds_property ON public.room_beds(property_id);

ALTER TABLE public.placements ADD COLUMN IF NOT EXISTS bed_id TEXT REFERENCES public.room_beds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_placements_bed_id ON public.placements(bed_id);

-- ---------------------------------------------------------------------
-- D. Item catalogue (shared) and common stock per property
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id TEXT PRIMARY KEY,
  item_code TEXT UNIQUE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  item_type TEXT NOT NULL DEFAULT 'Stock',    -- Stock (counted) | Asset (tracked one by one)
  unit TEXT DEFAULT 'each',
  default_room_quantity INTEGER DEFAULT 1,
  reorder_level INTEGER DEFAULT 0,
  unit_cost NUMERIC(12,2),
  supplier TEXT,
  requires_serial BOOLEAN DEFAULT false,
  requires_inspection BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

CREATE TABLE IF NOT EXISTS public.property_inventory_stock (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  minimum_level INTEGER DEFAULT 0,
  storage_location TEXT,
  last_counted_at TIMESTAMPTZ,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_property_stock_property ON public.property_inventory_stock(property_id);
CREATE INDEX IF NOT EXISTS idx_property_stock_item ON public.property_inventory_stock(item_id);

-- ---------------------------------------------------------------------
-- E. Items in rooms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_inventory (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES public.property_rooms(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition TEXT DEFAULT 'Good',
  status TEXT DEFAULT 'In Room',              -- In Room | Missing | Damaged | Removed
  serial_number TEXT,
  asset_id TEXT REFERENCES public.property_assets(id) ON DELETE SET NULL,
  issued_date DATE,
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_inventory_room ON public.room_inventory(room_id);
CREATE INDEX IF NOT EXISTS idx_room_inventory_property ON public.room_inventory(property_id);
CREATE INDEX IF NOT EXISTS idx_room_inventory_item ON public.room_inventory(item_id);

-- ---------------------------------------------------------------------
-- F. Stock / room movement ledger
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,   -- Purchase | Issue to Room | Return to Stock | Room Transfer | Damaged | Lost | Disposed | Stock Count
  item_id TEXT REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  from_room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL,
  to_room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL,
  reference TEXT,
  reason TEXT,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_property ON public.inventory_movements(property_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_from_room ON public.inventory_movements(from_room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_to_room ON public.inventory_movements(to_room_id);

-- ---------------------------------------------------------------------
-- G. Standard room kits
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_kit_templates (
  id TEXT PRIMARY KEY,
  template_name TEXT NOT NULL,
  room_type TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{ "itemId": "inv-...", "quantity": 1 }]
  is_active BOOLEAN DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- H. Room issues (defects / repairs / hazards)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_issues (
  id TEXT PRIMARY KEY,
  issue_reference TEXT,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES public.property_rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Maintenance',
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',                 -- Open | In Progress | Resolved | Closed
  description TEXT,
  reported_by TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to TEXT,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  cost NUMERIC(12,2),
  blocks_room BOOLEAN DEFAULT false,
  maintenance_record_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_issues_room ON public.room_issues(room_id);
CREATE INDEX IF NOT EXISTS idx_room_issues_property_status ON public.room_issues(property_id, status);

-- ---------------------------------------------------------------------
-- I. Room activity timeline
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_activity_log (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES public.property_rooms(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,                -- Note | Status Change | Cleaning | Inspection | Maintenance | Inventory | Placement | Issue
  title TEXT,
  details TEXT,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_activity_room ON public.room_activity_log(room_id, performed_at DESC);

-- ---------------------------------------------------------------------
-- J. updated_at triggers, and access: only the server (service_role) reads/writes these
--    tables; the browser goes through /api which applies site isolation (same as 013).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  new_tables TEXT[] := ARRAY[
    'room_beds', 'inventory_items', 'property_inventory_stock', 'room_inventory',
    'inventory_movements', 'room_kit_templates', 'room_issues', 'room_activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column()', 'trg_' || t || '_updated_at', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- K. Starter catalogue and room kits (safe to re-run; edit freely in the app afterwards)
-- ---------------------------------------------------------------------
INSERT INTO public.inventory_items
  (id, item_code, item_name, category, item_type, unit, default_room_quantity, reorder_level, requires_serial, requires_inspection, description)
VALUES
  ('inv-bed-single',      'FRN-001', 'Single bed frame',            'Furniture',  'Stock', 'each', 1, 2, false, false, 'Single bed frame'),
  ('inv-mattress',        'FRN-002', 'Mattress (fire retardant)',   'Furniture',  'Stock', 'each', 1, 4, false, true,  'Fire-retardant mattress'),
  ('inv-wardrobe',        'FRN-003', 'Wardrobe',                    'Furniture',  'Stock', 'each', 1, 1, false, false, NULL),
  ('inv-bedside',         'FRN-004', 'Bedside cabinet',             'Furniture',  'Stock', 'each', 1, 2, false, false, NULL),
  ('inv-desk',            'FRN-005', 'Desk',                        'Furniture',  'Stock', 'each', 1, 1, false, false, NULL),
  ('inv-chair',           'FRN-006', 'Chair',                       'Furniture',  'Stock', 'each', 1, 2, false, false, NULL),
  ('inv-drawers',         'FRN-007', 'Chest of drawers',            'Furniture',  'Stock', 'each', 1, 1, false, false, NULL),
  ('inv-bedlinen',        'BED-001', 'Bed linen set',               'Bedding',    'Stock', 'set',  2, 10, false, false, 'Fitted sheet + duvet cover + pillowcase'),
  ('inv-duvet',           'BED-002', 'Duvet',                       'Bedding',    'Stock', 'each', 1, 6, false, false, NULL),
  ('inv-pillow',          'BED-003', 'Pillow',                      'Bedding',    'Stock', 'each', 1, 6, false, false, NULL),
  ('inv-mattress-prot',   'BED-004', 'Mattress protector',          'Bedding',    'Stock', 'each', 1, 6, false, false, NULL),
  ('inv-blanket',         'BED-005', 'Blanket',                     'Bedding',    'Stock', 'each', 1, 4, false, false, NULL),
  ('inv-towel-set',       'BTH-001', 'Towel set',                   'Bathroom',   'Stock', 'set',  1, 10, false, false, 'Bath towel + hand towel'),
  ('inv-shower-curtain',  'BTH-002', 'Shower curtain',              'Bathroom',   'Stock', 'each', 1, 2, false, false, NULL),
  ('inv-bin',             'BTH-003', 'Waste bin',                   'Bathroom',   'Stock', 'each', 1, 4, false, false, NULL),
  ('inv-curtains',        'WND-001', 'Curtains / blind',            'Windows',    'Stock', 'each', 1, 2, false, false, NULL),
  ('inv-smoke-detector',  'SAF-001', 'Smoke detector',              'Fire Safety','Asset', 'each', 1, 2, true,  true,  'Tracked: test weekly'),
  ('inv-heat-detector',   'SAF-002', 'Heat detector',               'Fire Safety','Asset', 'each', 1, 1, true,  true,  NULL),
  ('inv-fire-blanket',    'SAF-003', 'Fire blanket',                'Fire Safety','Asset', 'each', 0, 1, false, true,  NULL),
  ('inv-door-closer',     'SAF-004', 'Fire door closer',            'Fire Safety','Asset', 'each', 1, 1, false, true,  NULL),
  ('inv-tv',              'ELC-001', 'Television',                  'Electrical', 'Asset', 'each', 0, 1, true,  true,  'PAT tested'),
  ('inv-fridge',          'ELC-002', 'Mini fridge',                 'Electrical', 'Asset', 'each', 0, 1, true,  true,  'PAT tested'),
  ('inv-lamp',            'ELC-003', 'Lamp',                        'Electrical', 'Asset', 'each', 1, 2, false, true,  'PAT tested'),
  ('inv-mirror',          'MSC-001', 'Mirror',                      'Other',      'Stock', 'each', 1, 1, false, false, NULL),
  ('inv-room-key',        'MSC-002', 'Room key / key card',         'Other',      'Stock', 'each', 2, 4, false, false, NULL),
  ('inv-welcome-pack',    'MSC-003', 'Welcome pack',                'Other',      'Stock', 'each', 1, 10, false, false, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.room_kit_templates (id, template_name, room_type, description, items)
VALUES
  ('kit-single', 'Standard single room', 'Single', 'Bed, bedding, storage, safety and bathroom basics for one resident',
   '[{"itemId":"inv-bed-single","quantity":1},{"itemId":"inv-mattress","quantity":1},{"itemId":"inv-mattress-prot","quantity":1},{"itemId":"inv-bedlinen","quantity":2},{"itemId":"inv-duvet","quantity":1},{"itemId":"inv-pillow","quantity":1},{"itemId":"inv-towel-set","quantity":1},{"itemId":"inv-wardrobe","quantity":1},{"itemId":"inv-bedside","quantity":1},{"itemId":"inv-chair","quantity":1},{"itemId":"inv-curtains","quantity":1},{"itemId":"inv-bin","quantity":1},{"itemId":"inv-smoke-detector","quantity":1},{"itemId":"inv-room-key","quantity":2}]'::jsonb),
  ('kit-twin', 'Standard twin room', 'Twin', 'Two beds with matching bedding and storage',
   '[{"itemId":"inv-bed-single","quantity":2},{"itemId":"inv-mattress","quantity":2},{"itemId":"inv-mattress-prot","quantity":2},{"itemId":"inv-bedlinen","quantity":4},{"itemId":"inv-duvet","quantity":2},{"itemId":"inv-pillow","quantity":2},{"itemId":"inv-towel-set","quantity":2},{"itemId":"inv-wardrobe","quantity":2},{"itemId":"inv-bedside","quantity":2},{"itemId":"inv-chair","quantity":2},{"itemId":"inv-curtains","quantity":1},{"itemId":"inv-bin","quantity":1},{"itemId":"inv-smoke-detector","quantity":1},{"itemId":"inv-room-key","quantity":2}]'::jsonb),
  ('kit-family', 'Family room', 'Family', 'Family room: four beds, extra storage',
   '[{"itemId":"inv-bed-single","quantity":4},{"itemId":"inv-mattress","quantity":4},{"itemId":"inv-mattress-prot","quantity":4},{"itemId":"inv-bedlinen","quantity":8},{"itemId":"inv-duvet","quantity":4},{"itemId":"inv-pillow","quantity":4},{"itemId":"inv-towel-set","quantity":4},{"itemId":"inv-wardrobe","quantity":2},{"itemId":"inv-drawers","quantity":1},{"itemId":"inv-bedside","quantity":2},{"itemId":"inv-chair","quantity":2},{"itemId":"inv-curtains","quantity":1},{"itemId":"inv-bin","quantity":2},{"itemId":"inv-smoke-detector","quantity":1},{"itemId":"inv-room-key","quantity":2}]'::jsonb)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Handy queries to paste into the SQL editor
-- =====================================================================
-- Rooms with occupancy, beds, open issues and items for one property:
--   SELECT r.room_number, r.room_name, r.room_type, r.floor, r.status, r.occupancy_status, r.capacity,
--          (SELECT COUNT(*) FROM public.placements p WHERE p.room_id = r.id AND p.status = 'Active') AS residents,
--          (SELECT COUNT(*) FROM public.room_beds b WHERE b.room_id = r.id) AS beds,
--          (SELECT COUNT(*) FROM public.room_issues i WHERE i.room_id = r.id AND i.status IN ('Open','In Progress')) AS open_issues,
--          (SELECT COALESCE(SUM(quantity),0) FROM public.room_inventory ri WHERE ri.room_id = r.id AND ri.status = 'In Room') AS items_in_room
--   FROM public.property_rooms r WHERE r.property_id = '<PROPERTY ID>' ORDER BY r.room_number;
--
-- Everything inside one room:
--   SELECT item_name, category, quantity, condition, status FROM public.room_inventory WHERE room_id = '<ROOM ID>' ORDER BY category, item_name;
--   SELECT asset_tag, asset_name, serial_number, condition, pat_next_due FROM public.property_assets WHERE room_id = '<ROOM ID>';
--
-- Common stock below its minimum level:
--   SELECT p.property_name, i.item_name, s.quantity_on_hand, s.minimum_level
--   FROM public.property_inventory_stock s
--   JOIN public.inventory_items i ON i.id = s.item_id
--   JOIN public.properties p ON p.id = s.property_id
--   WHERE s.quantity_on_hand < s.minimum_level ORDER BY p.property_name, i.item_name;
