insert into managers (user_id, name, position)
select
  id,
  coalesce(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1),
    'Unknown'
  ),
  'manager'
from auth.users;
