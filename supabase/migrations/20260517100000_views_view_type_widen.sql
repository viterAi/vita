-- Allow modern view-builder types (spatial default from API) alongside legacy enums.
alter table public.views drop constraint if exists views_view_type_check;

alter table public.views add constraint views_view_type_check check (
  view_type in (
    'aging_table',
    'follow_up_kanban',
    'spatial',
    'sequential',
    'briefing',
    'card',
    'config'
  )
);
