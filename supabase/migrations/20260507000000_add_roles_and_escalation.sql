-- Add role column to managers table
alter table managers
  add column role text not null default 'manager'
    check (role in ('admin', 'manager', 'user'));

-- Add escalation_status column to clients table
alter table clients
  add column escalation_status text not null default 'normal'
    check (escalation_status in ('normal', 'escalated', 'manager_active'));

-- Add clients to realtime publication for live status updates
alter publication supabase_realtime add table clients;

-- NOTE: After running this migration, manually update admin users in Supabase Dashboard:
-- UPDATE managers SET role = 'admin' WHERE user_id IN (
--   SELECT id FROM auth.users WHERE email IN ('kuzuberdin@...', 'u.shylko25@gmail.com')
-- );
