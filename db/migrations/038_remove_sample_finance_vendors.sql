-- Removes the six sample suppliers that migration 004 used to insert (Apex Facilities, Brakes, Total Commercial Laundry,
-- British Gas, Enterprise, Direct Site Supplies). They are not real suppliers and showed up in the supplier lists and
-- filters of Delivery Notes, Vendor Invoices and Credit Card Bills.
--
-- Only these six fixed ids are touched, so a real supplier with the same name is never affected.
-- finance_bills.vendor_id is ON DELETE SET NULL, so deleting a sample supplier that a bill points to would silently
-- blank that bill's supplier. Such a supplier is therefore kept and set to inactive; only unused ones are deleted.
-- Safe to re-run.
DO $$
DECLARE
  demo_id UUID;
BEGIN
  IF to_regclass('public.finance_vendors') IS NULL THEN RETURN; END IF;
  FOREACH demo_id IN ARRAY ARRAY[
    '00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0001-000000000002'::uuid,
    '00000000-0000-0000-0001-000000000003'::uuid, '00000000-0000-0000-0001-000000000004'::uuid,
    '00000000-0000-0000-0001-000000000005'::uuid, '00000000-0000-0000-0001-000000000006'::uuid
  ] LOOP
    IF to_regclass('public.finance_bills') IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.finance_bills WHERE vendor_id = demo_id) THEN
      UPDATE public.finance_vendors SET status = 'inactive' WHERE id = demo_id;
    ELSE
      DELETE FROM public.finance_vendors WHERE id = demo_id;
    END IF;
  END LOOP;
END $$;
