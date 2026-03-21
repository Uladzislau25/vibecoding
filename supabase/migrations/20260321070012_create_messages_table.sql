create table messages (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  user_id bigint not null,
  username varchar(32),
  first_name varchar(64),
  last_name varchar(64),
  text text not null,
  created_at timestamptz not null default now()
);
