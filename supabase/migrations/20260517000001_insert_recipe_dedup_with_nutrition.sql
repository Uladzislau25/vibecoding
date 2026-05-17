-- Extend insert_recipe_dedup to accept nutrition/time/servings.

create or replace function insert_recipe_dedup(
  p_title                varchar(256),
  p_description          text,
  p_ingredients          text,
  p_instructions         text,
  p_category             text,
  p_embedding            vector(1024),
  p_calories             int     default null,
  p_protein              numeric default null,
  p_fat                  numeric default null,
  p_carbs                numeric default null,
  p_cook_time            text    default null,
  p_servings             int     default null,
  p_similarity_threshold float   default 0.95
)
returns table (
  recipe_id   bigint,
  reused      boolean,
  description text
)
language plpgsql
volatile
as $$
declare
  v_existing_id   bigint;
  v_existing_desc text;
  v_new_id        bigint;
  v_lock_key      bigint;
begin
  v_lock_key := hashtextextended(lower(trim(coalesce(p_title, ''))), 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select r.id, r.description
    into v_existing_id, v_existing_desc
  from recipes r
  where r.embedding is not null
    and 1 - (r.embedding <=> p_embedding) >= p_similarity_threshold
  order by r.embedding <=> p_embedding
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, true, v_existing_desc;
    return;
  end if;

  insert into recipes (
    title, description, ingredients, instructions, category, embedding,
    calories, protein, fat, carbs, cook_time, servings
  )
  values (
    p_title, p_description, p_ingredients, p_instructions, p_category, p_embedding,
    p_calories, p_protein, p_fat, p_carbs, p_cook_time, p_servings
  )
  returning recipes.id into v_new_id;

  return query select v_new_id, false, p_description;
end;
$$;
