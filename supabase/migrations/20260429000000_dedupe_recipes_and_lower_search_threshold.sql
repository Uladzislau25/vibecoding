delete from recipes a
using recipes b
where a.id > b.id
  and lower(trim(a.title)) = lower(trim(b.title));

create unique index if not exists recipes_title_normalized_idx
  on recipes ((lower(trim(title))));

create or replace function search_recipes(
  query_embedding vector(1024),
  match_count int default 10
)
returns table (
  id bigint,
  title varchar(256),
  description text,
  ingredients text,
  instructions text,
  similarity float
)
language sql stable
as $$
  select
    recipes.id,
    recipes.title,
    recipes.description,
    recipes.ingredients,
    recipes.instructions,
    1 - (recipes.embedding <=> query_embedding) as similarity
  from recipes
  where recipes.embedding is not null
    and 1 - (recipes.embedding <=> query_embedding) >= 0.7
  order by recipes.embedding <=> query_embedding
  limit match_count;
$$;
