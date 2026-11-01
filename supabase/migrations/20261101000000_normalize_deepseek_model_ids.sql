-- DeepSeek now exposes only deepseek-flash (V4.1-Flash) and deepseek-v4-pro.
-- Legacy ids (deepseek-chat, deepseek-reasoner, deepseek-v4-flash) were silent
-- aliases that resolved to deepseek-flash; normalize to the canonical ids.

alter table chat_settings
  drop constraint if exists chat_settings_model_check;

update chat_settings
  set model = 'deepseek-flash'
  where model <> 'deepseek-v4-pro';

alter table chat_settings
  alter column model set default 'deepseek-flash';

alter table chat_settings
  add constraint chat_settings_model_check
    check (model in ('deepseek-flash', 'deepseek-v4-pro'));
