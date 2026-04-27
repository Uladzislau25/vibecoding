create extension if not exists vector;

create table recipes (
  id bigint generated always as identity primary key,
  title varchar(256) not null,
  description text,
  ingredients text not null,
  instructions text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index recipes_embedding_idx on recipes
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function search_recipes(
  query_embedding vector(1536),
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
