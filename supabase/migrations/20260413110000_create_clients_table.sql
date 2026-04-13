-- 1. Create clients table
create table clients (
  id bigint generated always as identity primary key,
  chat_id bigint not null unique,
  user_id bigint not null unique,
  username varchar(32),
  first_name varchar(64),
  last_name varchar(64),
  created_at timestamptz default now()
);

-- 2. Migrate unique clients from messages
insert into clients (chat_id, user_id, username, first_name, last_name, created_at)
select distinct on (chat_id)
  chat_id,
  user_id,
  username,
  first_name,
  last_name,
  min(created_at) over (partition by chat_id)
from messages
order by chat_id, created_at desc;

-- 3. Add client_id FK to messages
alter table messages
  add column client_id bigint references clients(id) on delete restrict;

-- 4. Backfill client_id from chat_id
update messages m
  set client_id = c.id
  from clients c
  where m.chat_id = c.chat_id;

-- 5. Make client_id not null
alter table messages
  alter column client_id set not null;

-- 6. Drop migrated columns from messages
alter table messages
  drop column chat_id,
  drop column user_id,
  drop column username,
  drop column first_name,
  drop column last_name;
