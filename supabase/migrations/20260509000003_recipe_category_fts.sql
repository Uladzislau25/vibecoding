-- Add category column to recipes
alter table recipes add column if not exists category text;

-- Drop old search_recipes signature, replace with hybrid version
drop function if exists search_recipes(vector, int);

create or replace function search_recipes(
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
  similarity   float
)
language sql stable
as $$
  -- Semantic matches (cosine similarity >= 0.7)
  with semantic as (
    select
      recipes.id,
      recipes.title,
      recipes.description,
      recipes.ingredients,
      recipes.instructions,
      recipes.category,
      1 - (recipes.embedding <=> query_embedding) as similarity
    from recipes
    where recipes.embedding is not null
      and 1 - (recipes.embedding <=> query_embedding) >= 0.7
    order by recipes.embedding <=> query_embedding
    limit match_count
  ),
  -- Full-text matches on title (only when query_text is provided)
  fts_matches as (
    select
      recipes.id,
      recipes.title,
      recipes.description,
      recipes.ingredients,
      recipes.instructions,
      recipes.category,
      0.6 as similarity
    from recipes
    where query_text <> ''
      and to_tsvector('russian', coalesce(recipes.title, '')) @@ plainto_tsquery('russian', query_text)
    limit match_count
  ),
  -- Union: prefer semantic similarity, dedup by id
  combined as (
    select * from semantic
    union all
    select * from fts_matches where id not in (select id from semantic)
  )
  select * from combined
  order by similarity desc
  limit match_count;
$$;
