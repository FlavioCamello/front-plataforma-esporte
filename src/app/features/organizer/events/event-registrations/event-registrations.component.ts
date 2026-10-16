import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Subscription, debounceTime, firstValueFrom } from 'rxjs';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { EventsApiService } from '../../../../core/events/events-api.service';
import { EventDetail } from '../../../../core/models/event.model';
import {
  EventRegistrationAggregatesDto,
  EventRegistrationDto,
  RegistrationStatus,
} from '../../../../core/models/registration.model';
import { RegistrationsApiService } from '../../../../core/registrations/registrations-api.service';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

@Component({
  selector: 'app-event-registrations',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './event-registrations.component.html',
  styleUrl: './event-registrations.component.scss',
})
export class EventRegistrationsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);
  private readonly registrationsApi = inject(RegistrationsApiService);
  private readonly fb = inject(FormBuilder);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly myEventsRoute = `${USER_HOME_ROUTE}/eventos`;
  readonly displayedColumns = [
    'athleteName',
    'status',
    'proofName',
    'categoryName',
    'shirtSize',
    'priceSnapshot',
    'athletePhone',
    'athleteEmail',
    'createdAt',
  ];

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly event = signal<EventDetail | null>(null);
  readonly items = signal<EventRegistrationDto[]>([]);
  readonly total = signal(0);
  readonly aggregates = signal<EventRegistrationAggregatesDto | null>(null);

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    proofId: [''],
    categoryId: [''],
    status: ['' as RegistrationStatus | ''],
  });

  readonly statusOptions: Array<{ value: RegistrationStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'Confirmed', label: 'Confirmada' },
    { value: 'Pending', label: 'Pendente' },
    { value: 'Cancelled', label: 'Cancelada' },
  ];

  private eventId = '';
  private sub?: Subscription;

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    this.sub = this.filters.valueChanges.pipe(debounceTime(300)).subscribe(() => void this.loadRegs());
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  statusLabel(status: string): string {
    return this.statusOptions.find((o) => o.value === status)?.label ?? status;
  }

  clearFilters(): void {
    this.filters.reset({ q: '', proofId: '', categoryId: '', status: '' });
  }

  hasActiveFilters(): boolean {
    const v = this.filters.getRawValue();
    return !!(v.q.trim() || v.proofId || v.categoryId || v.status);
  }

  private async bootstrap(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const detail = await firstValueFrom(this.eventsApi.getById(this.eventId)).catch((err) =>
        mapAuthHttpError(err, 'Evento não encontrado.')
      );
      this.event.set(detail);
      await this.loadRegs();
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.loading.set(false);
    }
  }

  private async loadRegs(): Promise<void> {
    if (!this.eventId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const v = this.filters.getRawValue();

    try {
      const page = await firstValueFrom(
        this.registrationsApi.listByEvent(this.eventId, {
          q: v.q.trim() || null,
          proofId: v.proofId || null,
          categoryId: v.categoryId || null,
          status: v.status || null,
          skip: 0,
          take: 100,
          sort: 'createdAt',
        })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível carregar os inscritos.'));

      this.items.set(page.items);
      this.total.set(page.total);
      this.aggregates.set(page.aggregates);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.items.set([]);
      this.aggregates.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
