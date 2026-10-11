import { Directive, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';

// Плавное появление при прокрутке (fade + rise), один раз
@Directive({ selector: '[reveal]', host: { class: 'reveal' } })
export class Reveal implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>).nativeElement;
  private io?: IntersectionObserver;

  ngOnInit() {
    if (typeof IntersectionObserver === 'undefined') return this.el.classList.add('shown');
    this.io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        this.el.classList.add('shown');
        this.io?.disconnect();
      },
      { threshold: 0.15 },
    );
    this.io.observe(this.el);
  }

  ngOnDestroy() {
    this.io?.disconnect();
  }
}
