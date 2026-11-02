-- More web user actions: persistent shopping list, pantry (saved products) and
-- structured preferences. Reads happen directly from the browser via RLS
-- (my_web_client_id()); writes go through SECURITY DEFINER RPCs that lazily
-- create the caller's web client (same pattern as rate_recipe/save_favorite).

-- ── Shopping list ──────────────────────────────────────────────────────────
create table if not exists shopping_list_items (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  item text not null,
  checked boolean not null default false,
  recipe_id bigint references recipes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_client_idx
  on shopping_list_items (client_id, created_at);

alter table shopping_list_items enable row level security;

create policy "shopping_list_items_admin"
  on shopping_list_items for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "shopping_list_items_web"
  on shopping_list_items for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());

create or replace function add_shopping_items(p_items text[], p_recipe_id bigint default null)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
  v_item text;
begin
  v_client_id := ensure_web_client();
  foreach v_item in array p_items loop
    if btrim(v_item) <> '' then
      insert into shopping_list_items (client_id, item, recipe_id)
        values (v_client_id, btrim(v_item), p_recipe_id);
    end if;
  end loop;
end;
$$;

create or replace function toggle_shopping_item(p_id bigint, p_checked boolean)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  update shopping_list_items set checked = p_checked
    where id = p_id and client_id = v_client_id;
end;
$$;

create or replace function clear_shopping_list(p_only_checked boolean default false)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  if p_only_checked then
    delete from shopping_list_items where client_id = v_client_id and checked;
  else
    delete from shopping_list_items where client_id = v_client_id;
  end if;
end;
$$;

-- ── Pantry (saved products) ────────────────────────────────────────────────
create table if not exists client_pantry (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  item text not null,
  created_at timestamptz not null default now(),
  unique (client_id, item)
);

alter table client_pantry enable row level security;

create policy "client_pantry_admin"
  on client_pantry for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

create policy "client_pantry_web"
  on client_pantry for all to authenticated
  using (client_id = my_web_client_id())
  with check (client_id = my_web_client_id());

create or replace function add_pantry_item(p_item text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  if btrim(p_item) <> '' then
    insert into client_pantry (client_id, item) values (v_client_id, btrim(p_item))
      on conflict (client_id, item) do nothing;
  end if;
end;
$$;

create or replace function remove_pantry_item(p_item text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  delete from client_pantry where client_id = v_client_id and item = btrim(p_item);
end;
$$;

-- ── Structured preferences ─────────────────────────────────────────────────
-- Keep dietary_notes (already injected into every recipe prompt) as the source
-- of truth for generation, but also store the structured form so the UI can
-- round-trip toggles and the calorie goal.
alter table client_preferences
  add column if not exists prefs jsonb not null default '{}'::jsonb;

create or replace function set_preferences_v2(p_prefs jsonb, p_notes text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
  v_notes text := coalesce(btrim(p_notes), '');
begin
  v_client_id := ensure_web_client();
  if v_notes = '' and (p_prefs is null or p_prefs = '{}'::jsonb) then
    delete from client_preferences where client_id = v_client_id;
  else
    insert into client_preferences (client_id, dietary_notes, prefs)
      values (v_client_id, v_notes, coalesce(p_prefs, '{}'::jsonb))
    on conflict (client_id) do update
      set dietary_notes = excluded.dietary_notes,
          prefs = excluded.prefs,
          updated_at = now();
  end if;
end;
$$;
