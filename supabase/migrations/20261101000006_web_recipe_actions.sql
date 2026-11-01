-- Web user actions: rate, save to favorites, set preferences. SECURITY DEFINER
-- so they resolve (and lazily create) the caller's web client across RLS.

create or replace function ensure_web_client()
returns bigint
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
    where auth_user_id = auth.uid() and platform = 'web' limit 1;
  if v_client_id is null then
    insert into clients (platform, auth_user_id) values ('web', auth.uid())
      returning id into v_client_id;
  end if;
  return v_client_id;
end;
$$;

create or replace function rate_recipe(p_recipe_id bigint, p_rating smallint)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  insert into recipe_ratings (client_id, recipe_id, rating)
    values (v_client_id, p_recipe_id, p_rating)
  on conflict (client_id, recipe_id) do update set rating = excluded.rating;
end;
$$;

create or replace function save_favorite(p_recipe_id bigint, p_title text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  insert into client_favorite_recipes (client_id, recipe_id, title)
    values (v_client_id, p_recipe_id, p_title)
  on conflict (client_id, recipe_id) do nothing;
end;
$$;

create or replace function set_preferences(p_notes text)
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  v_client_id := ensure_web_client();
  if p_notes is null or btrim(p_notes) = '' then
    delete from client_preferences where client_id = v_client_id;
  else
    insert into client_preferences (client_id, dietary_notes)
      values (v_client_id, btrim(p_notes))
    on conflict (client_id) do update
      set dietary_notes = excluded.dietary_notes, updated_at = now();
  end if;
end;
$$;
