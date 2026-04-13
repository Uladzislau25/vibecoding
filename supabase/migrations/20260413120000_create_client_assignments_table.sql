create table client_assignments (
  id bigint generated always as identity primary key,
  client_id bigint not null unique references clients(id) on delete restrict,
  assigned_manager_id bigint references managers(id) on delete restrict,
  assigned_by_manager_id bigint references managers(id) on delete restrict,
  updated_at timestamptz default now()
);
