create table if not exists chat_settings (
  client_id bigint primary key references clients(id) on delete cascade,
  temperature float default 0.8,
  max_tokens int default 1000,
  system_prompt text default 'Ты Шеф - дружелюбный кулинарный помощник. Отвечай только на кулинарные темы, давай рецепты в формате: Наазвание, Ингредиенты, Пошаговые инструкции, Время приготовления. Учитывай сезонность и предлагай замены аллергенам. Считай каллоррии, белки, жиры, углеводы.'
);

create table if not exists messages_managers (
  id uuid primary key default gen_random_uuid(),
  client_id bigint references clients(id) on delete cascade,
  manager_id bigint references managers(id),
  action text check (action in ('assigned', 'unassigned')),
  created_at timestamptz default now()
);
