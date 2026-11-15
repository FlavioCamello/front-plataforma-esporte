import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../../../environments/environment';
import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { formatEventDateRange } from '../../../../core/events/event-date-range';
import { EventsApiService } from '../../../../core/events/events-api.service';
import {
  PublishValidationError,
  mapPublishHttpError,
} from '../../../../core/events/publish-error';
import {
  EventDetail,
  EventReadiness,
  EventReadinessSection,
  EventReadinessSectionKey,
  EventReadinessStatus,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';
import { EVENT_SECTIONS as SECTIONS, EVENT_STATUS_LABELS, EventSectionMeta } from '../event-sections';

interface SectionCard extends EventSectionMeta {
  status: EventReadinessStatus;
  errors: string[];
}

@Component({
  selector: 'app-event-dashboard',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './event-dashboard.component.html',
  styleUrl: './event-dashboard.component.scss',
})
export class EventDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly basePath = `${USER_HOME_ROUTE}/eventos/${this.eventId}`;
  readonly listPath = `${USER_HOME_ROUTE}/eventos`;

  readonly loading = signal(true);
  readonly publishing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly shareMessage = signal<string | null>(null);
  readonly publishErrors = signal<string[]>([]);
  readonly event = signal<EventDetail | null>(null);
  readonly readiness = signal<EventReadiness | null>(null);

  readonly status = computed(() => this.event()?.status ?? 'Draft');
  readonly statusLabel = computed(() => EVENT_STATUS_LABELS[this.status()]);
  readonly isCancelled = computed(() => this.status() === 'Cancelled');
  readonly isClosed = computed(() => this.status() === 'Closed');
  readonly showPublish = computed(
    () => this.status() === 'Draft' || this.status() === 'Published'
  );
  readonly showRegistrations = computed(() => this.status() !== 'Draft');
  readonly showPublicPage = computed(
    () => this.status() === 'Published' || this.status() === 'Closed'
  );
  readonly showShare = computed(() => this.status() === 'Published');
  readonly dateRange = computed(() => {
    const ev = this.event();
    return ev ? formatEventDateRange(ev.startsAt, ev.endsAt) : '';
  });

  readonly cards = computed<SectionCard[]>(() => {
    const byKey = new Map<EventReadinessSectionKey, EventReadinessSection>(
      (this.readiness()?.sections ?? []).map((s) => [s.key, s])
    );
    return SECTIONS.map((meta) => {
      const section = byKey.get(meta.key);
      return {
        ...meta,
        status: section?.status ?? (meta.required ? 'pending' : 'optional'),
        errors: section?.errors ?? [],
      };
    });
  });

  readonly warningsCount = computed(() => this.readiness()?.warnings?.length ?? 0);

  readonly requiredTotal = SECTIONS.filter((s) => s.required).length;
  readonly requiredDone = computed(
    () => this.cards().filter((c) => c.required && c.status === 'complete').length
  );
  readonly progressPercent = computed(() =>
    Math.round((this.requiredDone() / this.requiredTotal) * 100)
  );

  ngOnInit(): void {
    void this.load();
  }

  sectionLink(card: SectionCard): string {
    return `${this.basePath}/${card.path}`;
  }

  statusText(card: SectionCard): string {
    switch (card.status) {
      case 'complete':
        return card.required ? 'Completa' : 'Configurada';
      case 'pending':
        return 'Pendente';
      default:
        return 'Opcional';
    }
  }

  statusIcon(card: SectionCard): string {
    switch (card.status) {
      case 'complete':
        return 'check_circle';
      case 'pending':
        return 'error';
      default:
        return 'radio_button_unchecked';
    }
  }

  publicUrl(): string {
    const slug = this.event()?.slug;
    if (!slug) {
      return '';
    }
    const origin = this.isBrowser
      ? this.doc.location?.origin || environment.siteUrl || ''
      : environment.siteUrl || '';
    return `${origin.replace(/\/$/, '')}/e/${slug}`;
  }

  async copyPublicLink(): Promise<void> {
    const url = this.publicUrl();
    if (!this.isBrowser || !url) {
      return;
    }
    this.shareMessage.set(null);
    try {
      await navigator.clipboard.writeText(url);
      this.shareMessage.set('Link público copiado.');
    } catch {
      this.shareMessage.set('Não foi possível copiar o link.');
    }
  }

  async sharePublicLink(): Promise<void> {
    const url = this.publicUrl();
    const name = this.event()?.name ?? 'Evento';
    if (!this.isBrowser || !url) {
      return;
    }
    this.shareMessage.set(null);
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: name, text: name, url });
        return;
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          return;
        }
      }
    }
    await this.copyPublicLink();
  }

  async publish(): Promise<void> {
    if (this.publishing() || !this.readiness()?.canPublish) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.publishErrors.set([]);
    this.publishing.set(true);
    try {
      const updated = await firstValueFrom(this.eventsApi.publish(this.eventId)).catch((err) =>
        mapPublishHttpError(err)
      );
      this.successMessage.set(`"${updated.name}" publicado com sucesso.`);
      await this.load();
    } catch (error) {
      if (error instanceof PublishValidationError) {
        this.publishErrors.set(error.errors);
        await this.load();
      } else {
        this.errorMessage.set(getAuthErrorMessage(error));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(this.event() === null);
    try {
      const [detail, readiness] = await Promise.all([
        firstValueFrom(this.eventsApi.getById(this.eventId)),
        firstValueFrom(this.eventsApi.readiness(this.eventId)),
      ]).catch((err) => mapAuthHttpError(err, 'Não foi possível carregar o evento.'));
      this.event.set(detail);
      this.readiness.set(readiness);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
