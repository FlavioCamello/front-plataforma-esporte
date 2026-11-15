import { CurrencyPipe, DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../../../environments/environment';
import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { formatEventDateRange } from '../../../../core/events/event-date-range';
import { EventsApiService } from '../../../../core/events/events-api.service';
import { PublishValidationError, mapPublishHttpError } from '../../../../core/events/publish-error';
import {
  CATEGORY_GENDER_OPTIONS,
  EventDetail,
  EventReadiness,
  EventReadinessWarning,
  PreviewLink,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';
import { EVENT_SECTIONS, EVENT_STATUS_LABELS } from '../event-sections';

interface PendingSection {
  title: string;
  path: string;
  errors: string[];
}

interface CategoryPriceRow {
  proofName: string;
  lotName: string;
  fullPrice: number;
  finalPrice: number;
}

/** UC-38 — revisão do que foi configurado + prévia + link temporário + publicar. */
@Component({
  selector: 'app-event-review',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe, MatButtonModule, MatIconModule],
  templateUrl: './event-review.component.html',
  styleUrl: './event-review.component.scss',
})
export class EventReviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly basePath = `${USER_HOME_ROUTE}/eventos/${this.eventId}`;

  readonly loading = signal(true);
  readonly publishing = signal(false);
  readonly linkBusy = signal(false);
  readonly copied = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly publishErrors = signal<string[]>([]);
  readonly event = signal<EventDetail | null>(null);
  readonly readiness = signal<EventReadiness | null>(null);
  /** Token em claro: só existe logo após gerar o link (o back guarda apenas o hash). */
  readonly freshLink = signal<PreviewLink | null>(null);

  readonly status = computed(() => this.event()?.status ?? 'Draft');
  readonly statusLabel = computed(() => EVENT_STATUS_LABELS[this.status()]);
  readonly canEditLink = computed(() => this.status() !== 'Cancelled');
  readonly showPublish = computed(
    () => this.status() === 'Draft' || this.status() === 'Published'
  );

  readonly pending = computed<PendingSection[]>(() => {
    const sections = this.readiness()?.sections ?? [];
    return EVENT_SECTIONS.flatMap((meta) => {
      const errors = sections.find((s) => s.key === meta.key)?.errors ?? [];
      return errors.length ? [{ title: meta.title, path: `${this.basePath}/${meta.path}`, errors }] : [];
    });
  });

  readonly warnings = computed<EventReadinessWarning[]>(() => this.readiness()?.warnings ?? []);

  readonly linkExpiresAt = computed(
    () => this.freshLink()?.expiresAt ?? this.event()?.previewLinkExpiresAt ?? null
  );
  readonly linkActive = computed(() => {
    const expiresAt = this.linkExpiresAt();
    return !!expiresAt && new Date(expiresAt).getTime() > Date.now();
  });
  readonly sharedUrl = computed(() => {
    const token = this.freshLink()?.token;
    if (!token) {
      return null;
    }
    const origin = this.doc.location?.origin || environment.siteUrl || '';
    return `${origin.replace(/\/$/, '')}/previa/${token}`;
  });

  readonly dateRange = computed(() => {
    const ev = this.event();
    return ev ? formatEventDateRange(ev.startsAt, ev.endsAt) : '';
  });

  readonly addressLine = computed(() => {
    const ev = this.event();
    if (!ev) {
      return '';
    }
    const a = ev.address;
    return [ev.venueName, a.city && a.state ? `${a.city}/${a.state}` : a.city || a.state]
      .filter(Boolean)
      .join(' · ');
  });

  readonly contactLine = computed(() => {
    const ev = this.event();
    if (!ev) {
      return '';
    }
    return [ev.contactEmail, ev.contactPhone].filter(Boolean).join(' · ');
  });

  readonly regulationLabel = computed(() => {
    const ev = this.event();
    if (!ev) {
      return '—';
    }
    if (ev.regulationUrl) {
      return 'URL cadastrada';
    }
    if (ev.regulationText?.trim()) {
      return 'Texto cadastrado';
    }
    return '—';
  });

  ngOnInit(): void {
    void this.load();
  }

  proofWarnings(proofId: string): EventReadinessWarning[] {
    return this.warnings().filter((w) => w.proofId === proofId);
  }

  categoryName(id: string): string {
    return this.event()?.categories.find((c) => c.id === id)?.name ?? id;
  }

  genderLabel(gender: string): string {
    return CATEGORY_GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? gender;
  }

  ageLabel(minAge?: number | null, maxAge?: number | null): string {
    if (minAge != null && maxAge != null) {
      return `${minAge}–${maxAge} anos`;
    }
    if (minAge != null) {
      return `${minAge}+ anos`;
    }
    if (maxAge != null) {
      return `até ${maxAge} anos`;
    }
    return 'Todas as idades';
  }

  /** Mesmo cálculo da inscrição (UC-26): desconto sobre o lote, 2 casas, nunca negativo. */
  categoryPrices(categoryId: string, discountPercent?: number | null): CategoryPriceRow[] {
    const discount = discountPercent && discountPercent > 0 ? Math.min(discountPercent, 100) : 0;
    return (this.event()?.proofs ?? [])
      .filter((p) => p.categoryIds.includes(categoryId))
      .flatMap((p) =>
        p.lots.map((lot) => ({
          proofName: p.name,
          lotName: lot.name,
          fullPrice: lot.price,
          finalPrice: Math.max(0, Math.round(lot.price * (100 - discount)) / 100),
        }))
      );
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

  async generateLink(): Promise<void> {
    if (this.linkBusy()) {
      return;
    }
    this.errorMessage.set(null);
    this.copied.set(false);
    this.linkBusy.set(true);
    try {
      const link = await firstValueFrom(this.eventsApi.createPreviewLink(this.eventId)).catch(
        (err) => mapAuthHttpError(err, 'Não foi possível gerar o link de prévia.')
      );
      this.freshLink.set(link);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.linkBusy.set(false);
    }
  }

  async revokeLink(): Promise<void> {
    if (this.linkBusy()) {
      return;
    }
    this.errorMessage.set(null);
    this.linkBusy.set(true);
    try {
      await firstValueFrom(this.eventsApi.revokePreviewLink(this.eventId)).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível revogar o link.')
      );
      this.freshLink.set(null);
      this.copied.set(false);
      this.event.update((ev) => (ev ? { ...ev, previewLinkExpiresAt: null } : ev));
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.linkBusy.set(false);
    }
  }

  async copyLink(): Promise<void> {
    const url = this.sharedUrl();
    if (!url || !this.isBrowser) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      this.errorMessage.set('Não foi possível copiar. Selecione o link e copie manualmente.');
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
