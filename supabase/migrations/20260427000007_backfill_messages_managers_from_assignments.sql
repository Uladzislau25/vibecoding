insert into messages_managers (client_id, manager_id, action, created_at)
select
  ca.client_id,
  ca.assigned_manager_id,
  'assigned',
  coalesce(ca.updated_at, now())
from client_assignments ca
where ca.assigned_manager_id is not null
  and not exists (
    select 1
    from messages_managers mm
    where mm.client_id = ca.client_id
      and mm.manager_id = ca.assigned_manager_id
      and mm.action = 'assigned'
  );
