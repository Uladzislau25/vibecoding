-- Helper function: get current user's role (bypasses RLS via SECURITY DEFINER)
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from managers where user_id = auth.uid() limit 1;
$$;

-- Enable RLS on all tables
alter table managers enable row level security;
alter table clients enable row level security;
alter table messages enable row level security;
alter table client_assignments enable row level security;
alter table chat_settings enable row level security;
alter table recipes enable row level security;
alter table messages_managers enable row level security;

-- Recipes: all authenticated users can read, admin/manager can write
create policy "recipes_select"
  on recipes for select to authenticated
  using (true);

create policy "recipes_write"
  on recipes for all to authenticated
  using (get_my_role() in ('admin', 'manager'))
  with check (get_my_role() in ('admin', 'manager'));

-- Managers: own row + admin/manager can read all; only admin can update roles
create policy "managers_select"
  on managers for select to authenticated
  using (user_id = auth.uid() or get_my_role() in ('admin', 'manager'));

create policy "managers_update"
  on managers for update to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- Clients, messages, assignments, settings: admin/manager only
create policy "clients_all"
  on clients for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "messages_all"
  on messages for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "client_assignments_all"
  on client_assignments for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "chat_settings_all"
  on chat_settings for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "messages_managers_all"
  on messages_managers for all to authenticated
  using (get_my_role() in ('admin', 'manager'));
