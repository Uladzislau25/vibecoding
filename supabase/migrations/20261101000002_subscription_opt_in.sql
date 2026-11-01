-- Switch the "recipe of the day" broadcast to opt-in: nobody receives it
-- until they explicitly /subscribe. Flip the default and clear existing rows.
alter table clients alter column subscribed set default false;
update clients set subscribed = false;
