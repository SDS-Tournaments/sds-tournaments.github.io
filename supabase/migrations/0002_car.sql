-- Машина пилота
alter table public.profiles
  add column car text check (char_length(car) <= 60),
  add column engine text check (char_length(engine) <= 60),
  add column gearbox text check (char_length(gearbox) <= 60),
  add column power_hp smallint check (power_hp between 1 and 5000);
