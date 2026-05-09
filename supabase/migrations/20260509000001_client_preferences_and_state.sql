-- User dietary preferences (injected into every recipe prompt)
create table if not exists client_preferences (
  client_id bigint primary key references clients(id) on delete cascade,
  dietary_notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table client_preferences enable row level security;

create policy "client_preferences_admin"
  on client_preferences for all to authenticated
  using (get_my_role() in ('admin', 'manager'));

-- Conversation state for multi-step flows (e.g. collecting preferences)
alter table clients
  add column if not exists setup_state text;
