-- 015 · Merge shaul-direct (zip-ingest channel) into wa-972533145330 (live GOWA channel)
--
-- Two parallel WhatsApp channels existed for the same conversation:
--   - shaul-direct: created by the WhatsApp zip importer (zip ingest path)
--   - wa-972533145330: created by the live GOWA webhook
-- This merges all l1_events to the live channel and tombstones the slug
-- channel so it disappears from the rail (the apps/web query filters
-- `identifier NOT LIKE 'archived__%'`).
--
-- Already applied to vita prod (dkccadwohifcqcdzhhnu) via MCP.

update public.l1_events
   set channel_id = '5b1b1b2b-29ee-4d6e-a601-ff578b104e43'  -- wa-972533145330
 where channel_id = '9105c8b0-9637-4eed-baf9-63616b2a0959'; -- shaul-direct

update public.channels
   set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
     'merged_from', jsonb_build_array('shaul-direct'),
     'merged_at', now(),
     'principal_id', '7f17cd49-6091-4b52-aea1-0f2662e3412e',
     'principal_canonical_id', 'shaul-levine'
   )
 where id = '5b1b1b2b-29ee-4d6e-a601-ff578b104e43';

update public.channels
   set identifier = 'archived__shaul-direct',
       display_name = 'archived: merged into wa-972533145330',
       metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
         'merged_into', '5b1b1b2b-29ee-4d6e-a601-ff578b104e43',
         'archived_at', now()
       )
 where id = '9105c8b0-9637-4eed-baf9-63616b2a0959';
