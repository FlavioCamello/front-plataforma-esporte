import { CurrencyPipe, DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  HostListener,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { getAuthErrorMessage, mapAuthHttpError } from '../../../core/auth/auth-http.util';
import { formatEventDateRange } from '../../../core/events/event-date-range';
import { resolveMapUrl } from '../../../core/events/event-map-url';
import { EventsApiService } from '../../../core/events/events-api.service';
import { PublicEventsApiService } from '../../../core/events/public-events-api.service';
import {
  CATEGORY_GENDER_OPTIONS,
  PublicEventDetail,
  SPORT_TYPE_OPTIONS,
} from '../../../core/models/event.model';
import { markdownToPlainText } from '../../../core/markdown/safe-markdown';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';
import { SafeMarkdownComponent } from '../../../shared/safe-markdown/safe-markdown.component';

/**
 * UC-38 — `owner-preview`: dono vê em qualquer status (`/home/eventos/:id/previa`);
 * `shared-preview`: link temporário sem login (`/previa/:token`).
 */
export type EventPageMode = 'public' | 'owner-preview' | 'shared-preview';

@Component({
  selector: 'app-event-page',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe, SafeMarkdownComponent],
  templateUrl: './event-page.component.html',
  styleUrl: './event-page.component.scss',
})
export class EventPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PublicEventsApiService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly mode: EventPageMode = this.route.snapshot.data['mode'] ?? 'public';
  readonly isPreview = this.mode !== 'public';
  readonly reviewPath = `${USER_HOME_ROUTE}/eventos/${this.route.snapshot.paramMap.get('id') ?? ''}/revisao`;
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly event = signal<PublicEventDetail | null>(null);
  /** Lightbox do mapa de percurso (mostrar imagem inteira, sem corte). */
  readonly lightbox = signal<{ src: string; alt: string } | null>(null);

  readonly organizerBlocked = computed(
    () => !this.isPreview && this.auth.currentUser()?.accountType === 'Organizer'
  );

  readonly bannerUrl = computed(
    () =>
      this.event()?.bannerUrl ||
      'https://images.unsplash.com/photo-1452626038306-a576fb48b39f?auto=format&fit=crop&w=1600&q=80'
  );

  readonly addressLine = computed(() => {
    const a = this.event()?.address;
    if (!a) {
      return '';
    }
    return [a.street, a.number, a.neighborhood, a.city, a.state].filter(Boolean).join(', ');
  });

  readonly dateRange = computed(() => {
    const ev = this.event();
    return ev ? formatEventDateRange(ev.startsAt, ev.endsAt) : '';
  });

  readonly mapHref = computed(() => {
    const ev = this.event();
    return ev ? resolveMapUrl(ev.mapUrl, ev.venueName, ev.address) : null;
  });

  readonly kitPickupText = computed(() => {
    const kit = this.event()?.modules.kitPickup;
    const text = kit?.description?.trim();
    return kit?.enabled && text ? text : null;
  });

  readonly eventSoldOut = computed(() => this.event()?.soldOut === true);

  /**
   * Na prévia de um rascunho, mostra o selo que o atleta verá depois de publicar
   * (aberto se o prazo ainda não passou), em vez de "encerradas".
   */
  readonly registrationOpen = computed(() => {
    const ev = this.event();
    if (!ev) {
      return false;
    }
    if (this.isPreview && ev.status === 'Draft') {
      return !ev.registrationClosesAt || new Date(ev.registrationClosesAt).getTime() > Date.now();
    }
    return ev.registrationOpen;
  });

  readonly ctaLabel = computed(() => {
    if (this.isPreview) {
      return 'Inscrição desabilitada na prévia';
    }
    if (this.eventSoldOut()) {
      return 'Esgotado';
    }
    return this.registrationOpen() ? 'Inscrever-se' : 'Inscrições encerradas';
  });

  readonly ctaDisabled = computed(
    () => this.isPreview || this.eventSoldOut() || !this.registrationOpen()
  );

  ngOnInit(): void {
    void this.load();
  }

  sportLabel(sportType: string): string {
    return SPORT_TYPE_OPTIONS.find((o) => o.value === sportType)?.label ?? sportType;
  }

  genderLabel(gender: string): string {
    return CATEGORY_GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? gender;
  }

  categoryNames(categoryIds: string[]): string {
    const cats = this.event()?.categories ?? [];
    return categoryIds
      .map((id) => cats.find((c) => c.id === id)?.name ?? id)
      .join(', ');
  }

  onCtaClick(): void {
    const ev = this.event();
    if (this.isPreview || this.organizerBlocked() || !ev?.registrationOpen || ev.soldOut) {
      return;
    }

    const registerUrl = `/e/${ev.slug}/inscricao`;

    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: registerUrl },
      });
      return;
    }

    if (!this.auth.profileComplete()) {
      void this.router.navigate(['/auth/completar-perfil'], {
        queryParams: { returnUrl: registerUrl },
      });
      return;
    }

    void this.router.navigateByUrl(registerUrl);
  }

  openRouteLightbox(src: string, alt: string): void {
    this.lightbox.set({ src, alt });
    this.setBodyScrollLocked(true);
  }

  closeLightbox(): void {
    this.lightbox.set(null);
    this.setBodyScrollLocked(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightbox()) {
      this.closeLightbox();
    }
  }

  private setBodyScrollLocked(locked: boolean): void {
    if (!this.isBrowser) {
      return;
    }
    this.doc.body.style.overflow = locked ? 'hidden' : '';
  }

  private loadDetail() {
    const params = this.route.snapshot.paramMap;
    switch (this.mode) {
      case 'owner-preview':
        return this.eventsApi.preview(params.get('id') ?? '');
      case 'shared-preview':
        return this.api.getSharedPreview(params.get('token') ?? '');
      default:
        return this.api.getBySlug(params.get('slug') ?? '');
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    if (this.isPreview) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }
    try {
      const notFound =
        this.mode === 'shared-preview'
          ? 'Link de prévia inválido ou expirado.'
          : 'Evento não encontrado.';
      const detail = await firstValueFrom(this.loadDetail()).catch((err) =>
        mapAuthHttpError(err, notFound)
      );
      this.event.set(detail);
      if (this.isPreview) {
        this.title.setTitle(`Prévia · ${detail.name}`);
      } else {
        this.applySeo(detail);
      }
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.event.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * UC-20 (front-only): title + meta description + Open Graph + Twitter + canonical.
   * Observação: como o app é uma SPA sem SSR, estas tags são injetadas via JS.
   * Crawlers de preview (WhatsApp/Facebook/etc.) não executam JS — o preview social
   * completo depende de SSR/prerender (decisão adiada no doc do UC-20).
   */
  private applySeo(detail: PublicEventDetail): void {
    const title = `${detail.name} · ${detail.organizerName}`;
    const description = this.buildSeoDescription(detail);
    const image = this.bannerUrl();
    const url = this.canonicalUrl(detail.slug);

    this.title.setTitle(title);

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: detail.name });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Plataforma Esporte' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: detail.name });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    this.setCanonical(url);
  }

  private buildSeoDescription(detail: PublicEventDetail): string {
    const base = markdownToPlainText(detail.description);
    if (base) {
      return base.length > 200 ? `${base.slice(0, 197)}…` : base;
    }
    const parts = [this.sportLabel(detail.sportType)];
    if (detail.venueName) {
      parts.push(detail.venueName);
    }
    if (detail.address?.city) {
      parts.push(detail.address.city);
    }
    return `${detail.name} — ${parts.join(' · ')}`;
  }

  private canonicalUrl(slug: string): string {
    // No navegador usa a origem real; no servidor (SSR) usa a URL pública do ambiente.
    const origin = this.doc.location?.origin || environment.siteUrl || '';
    return `${origin.replace(/\/$/, '')}/e/${slug}`;
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
