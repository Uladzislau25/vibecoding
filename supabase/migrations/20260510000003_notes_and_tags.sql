-- Allow 'note' sender_type (internal manager notes, not sent to Telegram)
alter table messages drop constraint if exists messages_sender_type_check;
alter table messages add constraint messages_sender_type_check
  check (sender_type in ('client', 'manager', 'bot', 'note'));

-- Tags / labels on clients
alter table clients add column if not exists tags text[] not null default '{}';
