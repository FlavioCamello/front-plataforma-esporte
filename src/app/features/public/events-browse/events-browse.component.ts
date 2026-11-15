import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, debounceTime, firstValueFrom } from 'rxjs';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../core/auth/auth-http.util';
import { formatEventDateRange } from '../../../core/events/event-date-range';
import { PublicEventsApiService } from '../../../core/events/public-events-api.service';
import { PublicEventListItem, SPORT_TYPE_OPTIONS } from '../../../core/models/event.model';

@Component({
  selector: 'app-events-browse',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './events-browse.component.html',
  styleUrl: './events-browse.component.scss',
})
export class EventsBrowseComponent implements OnInit, OnDestroy {
  private readonly api = inject(PublicEventsApiService);
  private readonly fb = inject(FormBuilder);
  readonly sportTypes = SPORT_TYPE_OPTIONS;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly items = signal<PublicEventListItem[]>([]);
  readonly total = signal(0);

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    city: [''],
    state: [''],
    sportType: [''],
  });

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.filters.valueChanges.pipe(debounceTime(350)).subscribe(() => void this.load());
    void this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  sportLabel(sportType: string): string {
    return SPORT_TYPE_OPTIONS.find((o) => o.value === sportType)?.label ?? sportType;
  }

  dateRange(item: PublicEventListItem): string {
    return formatEventDateRange(item.startsAt, item.endsAt);
  }

  hasActiveFilters(): boolean {
    const v = this.filters.getRawValue();
    return !!(v.q.trim() || v.city.trim() || v.state.trim() || v.sportType);
  }

  clearFilters(): void {
    this.filters.reset({ q: '', city: '', state: '', sportType: '' });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    const v = this.filters.getRawValue();
    try {
      const page = await firstValueFrom(
        this.api.list({
          skip: 0,
          take: 50,
          sort: 'startsAt',
          q: v.q,
          city: v.city,
          state: v.state,
          sportType: v.sportType || null,
        })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível carregar os eventos.'));

      this.items.set(page.items);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
