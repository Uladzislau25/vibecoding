alter table recipes
  add column calories  int,
  add column protein   numeric(5,1),
  add column fat       numeric(5,1),
  add column carbs     numeric(5,1),
  add column cook_time text,
  add column servings  int;
