-- Phase 1: generalize `clients` so web (PWA) users live alongside Telegram ones.
-- Telegram rows stay keyed by chat_id/user_id; web rows are keyed by auth_user_id
-- (a Supabase Auth user). All related tables already reference clients.id, so
-- messages/favorites/preferences/ratings work for web users for free.

alter table clients
  alter column chat_id drop not null,
  alter column user_id drop not null;

alter table clients
  add column platform text not null default 'telegram',
  add column auth_user_id uuid references auth.users(id) on delete cascade;

alter table clients
  add constraint clients_platform_check check (platform in ('telegram', 'web'));

-- Each platform must carry the identity it is keyed on.
alter table clients
  add constraint clients_identity_check check (
    (platform = 'telegram' and chat_id is not null)
    or (platform = 'web' and auth_user_id is not null)
  );

-- One client row per auth user (nulls for telegram rows are ignored).
create unique index clients_auth_user_id_key
  on clients (auth_user_id)
  where auth_user_id is not null;

-- Resolve the current web user's client id, bypassing RLS to avoid recursion
-- when referenced from other tables' policies (same pattern as get_my_role).
create or replace function my_web_client_id()
returns bigint
language sql
security definer
stable
as $$
  select id from clients
  where auth_user_id = auth.uid() and platform = 'web'
  limit 1;
$$;

-- Web users: read/update only their own client row.
create policy "clients_web_self_select"
  on clients for select to authenticated
  using (auth_user_id = auth.uid());

create policy "clients_web_self_update"
  on clients for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Web users: read only their own messages (writes happen server-side via service role).
create policy "messages_web_self"
  on messages for select to authenticated
  using (client_id = my_web_client_id());

-- Web users: full access to their own favorites / preferences / ratings.
create policy "client_favorite_recipes_web"
  on client_favorite_recipes for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());

create policy "client_preferences_web"
  on client_preferences for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());

create policy "recipe_ratings_web"
  on recipe_ratings for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());
