-- Opt-in/opt-out flag for the periodic "recipe of the day" broadcast.
-- Default true: existing users keep receiving the digest; they can opt out
-- with /unsubscribe (alias /stop) and opt back in with /subscribe.
alter table clients
  add column subscribed boolean not null default true;
