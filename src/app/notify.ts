import { supabase } from './auth';

/** Оповещение в Discord (фоном: ошибка Discord не должна мешать работе сайта) */
export function notify(type: 'registration' | 'stage_start' | 'battles_start' | 'results' | 'protest' | 'test' | 'groups', id: number) {
  return supabase.functions.invoke('discord-notify', { body: { type, id } }).catch(() => {});
}
