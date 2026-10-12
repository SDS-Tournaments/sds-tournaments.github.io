import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, switchMap, timer } from 'rxjs';

/**
 * Публичные страницы (data.preload) подгружаются заранее, когда сайт уже открылся, — переходы по меню мгновенные.
 * Админка и пульты не грузятся. На экономии трафика и медленном (2G) интернете — не предзагружаем.
 */
@Injectable({ providedIn: 'root' })
export class PublicPreload implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!route.data?.['preload'] || c?.saveData || /2g/.test(c?.effectiveType ?? '')) return of(null);
    return timer(2000).pipe(switchMap(load));
  }
}
