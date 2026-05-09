-- Idempotency: prevent duplicate processing of same Telegram message
alter table messages
  add column if not exists telegram_message_id bigint;

create unique index if not exists messages_telegram_message_id_unique
  on messages (telegram_message_id)
  where telegram_message_id is not null;

-- Track which recipe was shown in a bot message (for /save and /list commands)
alter table messages
  add column if not exists recipe_id bigint references recipes(id) on delete set null;
