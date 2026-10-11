import { inject, Injectable, Injector, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { createClient, Session } from '@supabase/supabase-js';
import { filter, firstValueFrom } from 'rxjs';
import { SUPABASE_KEY, SUPABASE_URL } from './supabase.config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Profile {
  id: string;
  steam_id: string;
  nickname: string;
  avatar_url: string | null;
  role: 'admin' | 'staff' | 'pilot';
  start_number: number | null;
  /** сезон, в котором пилот выбрал номер (0009): в этом сезоне сменить его может только админ */
  number_season_id: number | null;
  livery_url: string | null;
  car: string | null;
  engine: string | null;
  gearbox: string | null;
  power_hp: number | null;
  bio_ru: string | null;
  bio_en: string | null;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  /** true после того, как supabase-js восстановил (или не нашёл) сессию */
  readonly ready = signal(false);
  private readonly injector = inject(Injector);

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      // вне колбэка: supabase-js не любит запросы внутри onAuthStateChange
      setTimeout(async () => {
        await this.loadProfile(session?.user.id);
        this.ready.set(true);
      });
    });
  }

  /** Дождаться восстановления сессии и профиля */
  whenReady() {
    return firstValueFrom(toObservable(this.ready, { injector: this.injector }).pipe(filter(Boolean)));
  }

  login() {
    const redirect = `${location.origin}/auth/callback`;
    location.href = `${SUPABASE_URL}/functions/v1/steam-auth?redirect=${encodeURIComponent(redirect)}`;
  }

  logout() {
    return supabase.auth.signOut();
  }

  reload() {
    return this.loadProfile(this.session()?.user.id);
  }

  /** Возврат из Steam: #token_hash=… → сессия. Возвращает текст ошибки или null. */
  async finishLogin(hash: string): Promise<string | null> {
    const p = new URLSearchParams(hash.replace(/^#/, ''));
    if (p.get('error')) return p.get('error');
    const token_hash = p.get('token_hash');
    if (!token_hash) return 'no_token';
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
    return error?.message ?? null;
  }

  private async loadProfile(id?: string) {
    if (!id) return this.profile.set(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, steam_id, nickname, avatar_url, role, start_number, number_season_id, livery_url, car, engine, gearbox, power_hp, bio_ru, bio_en')
      .eq('id', id)
      .single();
    this.profile.set(data);
  }
}

/** Пускает только организатора и судей (настоящая защита данных — RLS в базе) */
export const staffGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router); // до await — после него контекст inject() теряется
  await auth.whenReady();
  const role = auth.profile()?.role;
  return role === 'admin' || role === 'staff' || router.parseUrl('/');
};
