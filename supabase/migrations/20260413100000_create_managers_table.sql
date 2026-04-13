create table managers (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete restrict,
  name varchar(128) not null,
  position varchar(64) not null,
  created_at timestamptz default now()
);
