-- Demo: let the app find-or-create users by display_name (powers live chat and
-- ad-hoc patients) without needing a matching auth.users row. The original
-- schema tied users.id to auth.users(id) with no default, so client inserts
-- failed with a not-null id violation. Safe for the local/demo stack; revert
-- when wiring real Supabase Auth.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
