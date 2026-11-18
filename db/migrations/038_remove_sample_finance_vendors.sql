-- Removes the two sample suppliers that migration 004 inserted purely as demo data: Apex Facilities & Commercial Cleaning Ltd
-- and Direct Site Supplies & Maintenance Ltd. They showed up in the supplier lists and filters of Delivery Notes,
-- Vendor Invoices and Credit Card Bills.
--
-- The other four suppliers from that seed (Brakes, Total Commercial Laundry, British Gas, Enterprise) are real companies the
-- business may use, so they are left exactly as they are.
-- Only the two fixed ids below are touched. finance_bills.vendor_id is ON DELETE SET NULL, so deleting a sample supplier
-- that a bill points to would silently blank that bill's supplier; such a supplier is kept and set to inactive instead.
-- Safe to re-run.
DO $$
DECLARE
  demo_id UUID;
BEGIN
  IF to_regclass('public.finance_vendors') IS NULL THEN RETURN; END IF;
  FOREACH demo_id IN ARRAY ARRAY[
    '00000000-0000-0000-0001-000000000001'::uuid,
    '00000000-0000-0000-0001-000000000006'::uuid
  ] LOOP
    IF to_regclass('public.finance_bills') IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.finance_bills WHERE vendor_id = demo_id) THEN
      UPDATE public.finance_vendors SET status = 'inactive' WHERE id = demo_id;
    ELSE
      DELETE FROM public.finance_vendors WHERE id = demo_id;
    END IF;
  END LOOP;
END $$;
