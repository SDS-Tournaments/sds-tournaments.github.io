import { Injectable, signal } from '@angular/core';
import { createClient, Session } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './supabase.config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface Profile {
  id: string;
  steam_id: string;
  nickname: string;
  avatar_url: string | null;
  role: 'admin' | 'staff' | 'pilot';
  start_number: number | null;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      // вне колбэка: supabase-js не любит запросы внутри onAuthStateChange
      setTimeout(() => this.loadProfile(session?.user.id));
    });
  }

  login() {
    const redirect = `${location.origin}/auth/callback`;
    location.href = `${SUPABASE_URL}/functions/v1/steam-auth?redirect=${encodeURIComponent(redirect)}`;
  }

  logout() {
    return supabase.auth.signOut();
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
      .select('id, steam_id, nickname, avatar_url, role, start_number')
      .eq('id', id)
      .single();
    this.profile.set(data);
  }
}
