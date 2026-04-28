drop index if exists recipes_embedding_idx;
drop function if exists search_recipes(vector, int);

alter table recipes drop column if exists embedding;
alter table recipes add column embedding vector(1024);

create index recipes_embedding_idx on recipes
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

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
    and 1 - (recipes.embedding <=> query_embedding) >= 0.82
  order by recipes.embedding <=> query_embedding
  limit match_count;
$$;
