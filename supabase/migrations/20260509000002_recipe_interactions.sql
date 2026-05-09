-- Recipe ratings via inline keyboard (👍 / 👎)
create table if not exists recipe_ratings (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  recipe_id bigint not null references recipes(id) on delete cascade,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz not null default now(),
  unique(client_id, recipe_id)
);

alter table recipe_ratings enable row level security;

create policy "recipe_ratings_admin"
  on recipe_ratings for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

-- Favourite recipes saved by users (via ⭐ button or /save command)
create table if not exists client_favorite_recipes (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients(id) on delete cascade,
  recipe_id bigint not null references recipes(id) on delete cascade,
  title text not null,
  saved_at timestamptz not null default now(),
  unique(client_id, recipe_id)
);

alter table client_favorite_recipes enable row level security;

create policy "client_favorite_recipes_admin"
  on client_favorite_recipes for all to authenticated
  using (get_my_role() in ('admin', 'manager'));
