-- Extend search_recipes to return nutrition/time/servings.

drop function if exists search_recipes(vector(1024), text, int);

create function search_recipes(
  query_embedding vector(1024),
  query_text      text    default '',
  match_count     int     default 10
)
returns table (
  id           bigint,
  title        varchar(256),
  description  text,
  ingredients  text,
  instructions text,
  category     text,
  calories     int,
  protein      numeric,
  fat          numeric,
  carbs        numeric,
  cook_time    text,
  servings     int,
  similarity   float
)
language sql stable
as $$
  with semantic as (
    select
      r.id, r.title, r.description, r.ingredients, r.instructions, r.category,
      r.calories, r.protein, r.fat, r.carbs, r.cook_time, r.servings,
      1 - (r.embedding <=> query_embedding) as similarity
    from recipes r
    where r.embedding is not null
      and 1 - (r.embedding <=> query_embedding) >= 0.7
    order by r.embedding <=> query_embedding
    limit match_count
  ),
  fts_matches as (
    select
      r.id, r.title, r.description, r.ingredients, r.instructions, r.category,
      r.calories, r.protein, r.fat, r.carbs, r.cook_time, r.servings,
      0.6 as similarity
    from recipes r
    where query_text <> ''
      and to_tsvector('russian', coalesce(r.title, '')) @@ plainto_tsquery('russian', query_text)
    limit match_count
  ),
  combined as (
    select * from semantic
    union all
    select * from fts_matches where id not in (select id from semantic)
  )
  select * from combined
  order by similarity desc
  limit match_count;
$$;
