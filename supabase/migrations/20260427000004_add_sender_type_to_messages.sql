alter table messages
  add column if not exists sender_type text not null default 'client'
    check (sender_type in ('client', 'manager', 'bot'));

alter table messages
  add column if not exists manager_id bigint references managers(id);
