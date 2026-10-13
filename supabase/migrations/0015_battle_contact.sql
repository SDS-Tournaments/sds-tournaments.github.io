-- Дуэль проиграна из-за контакта: пилот врезался в соперника, который ехал впереди (ачивка «Божественное касание»)
alter type public.battle_result add value if not exists 'contact';
