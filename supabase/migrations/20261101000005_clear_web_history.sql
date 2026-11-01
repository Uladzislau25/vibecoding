-- Let a web user wipe their own chat history. SECURITY DEFINER so it can delete
-- across the (select-only) web RLS on messages.
create or replace function clear_my_web_history()
returns void
language plpgsql
security definer
as $$
declare
  v_client_id bigint;
begin
  select id into v_client_id from clients
    where auth_user_id = auth.uid() and platform = 'web'
    limit 1;
  if v_client_id is not null then
    delete from messages where client_id = v_client_id;
  end if;
end;
$$;
