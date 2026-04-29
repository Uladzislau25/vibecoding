alter table messages add column if not exists prompt_tokens int;
alter table messages add column if not exists completion_tokens int;
alter table messages add column if not exists total_tokens int;
