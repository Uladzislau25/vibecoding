-- Phase 5: Web Push subscriptions for the PWA "recipe of the day".

create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_admin"
  on push_subscriptions for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "push_subscriptions_web"
  on push_subscriptions for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());

-- Save (or refresh) a push subscription for the current web user, lazily
-- creating their client row. SECURITY DEFINER so it can resolve/insert across RLS.
create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_client_id from clients
    where auth_user_id = auth.uid() and platform = 'web'
    limit 1;

  if v_client_id is null then
    insert into clients (platform, auth_user_id)
      values ('web', auth.uid())
      returning id into v_client_id;
  end if;

  insert into push_subscriptions (client_id, endpoint, p256dh, auth)
    values (v_client_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set client_id = excluded.client_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;
