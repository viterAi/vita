-- 014 · Principal alias migration — Shaul's phone + WA variants.
--
-- 972533145330 is Shaul's WhatsApp. Channels created from inbound webhook
-- events take their display_name from the *first* push_name seen, which
-- for outbound messages is the sender (mordechai), not the recipient. We
-- fix the channel label here and add the phone + common spellings to
-- Shaul's principal.identifiers so future actor resolution can match.
--
-- Idempotent: jsonb_agg(distinct …) dedupes; channel update only renames
-- when the current display_name still matches the buggy fallback.

update public.principals
   set identifiers = (
     select jsonb_agg(distinct value)
       from jsonb_array_elements(
         coalesce(identifiers, '[]'::jsonb) || '[
           "972533145330",
           "+972533145330",
           "972533145330@s.whatsapp.net",
           "Shaul",
           "shaul",
           "Shaul Levine",
           "shaul levine"
         ]'::jsonb
       )
   ),
   metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
     'phone_e164', '+972533145330',
     'whatsapp_jid', '972533145330@s.whatsapp.net',
     'aliases_added_at', now()
   )
 where canonical_id = 'shaul-levine';

-- Re-label the channel so the rail shows "Shaul Levine" instead of
-- whichever push_name happened to land first.
update public.channels
   set display_name = 'WhatsApp · Shaul Levine'
 where kind = 'whatsapp'
   and identifier = 'wa-972533145330';
