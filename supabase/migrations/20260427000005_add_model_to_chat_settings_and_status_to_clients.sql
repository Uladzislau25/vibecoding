alter table chat_settings
  add column if not exists model text not null default 'deepseek-chat'
    check (model in ('deepseek-chat', 'deepseek-reasoner'));

alter table clients
  add column if not exists status text not null default 'open'
    check (status in ('open', 'closed'));
