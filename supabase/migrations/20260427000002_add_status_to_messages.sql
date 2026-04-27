alter table messages add column if not exists status text default 'pending' check (status in ('pending', 'active', 'closed'));
