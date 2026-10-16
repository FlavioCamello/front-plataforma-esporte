import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { EventsApiService } from '../../../../core/events/events-api.service';
import {
  PublishValidationError,
  mapPublishHttpError,
} from '../../../../core/events/publish-error';
import { EventListItem, EventStatus } from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

@Component({
  selector: 'app-my-events',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './my-events.component.html',
  styleUrl: './my-events.component.scss',
})
export class MyEventsComponent implements OnInit {
  private readonly eventsApi = inject(EventsApiService);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly createRoute = `${USER_HOME_ROUTE}/eventos/novo`;
  readonly displayedColumns = ['name', 'status', 'startsAt', 'place', 'updatedAtUtc', 'actions'];

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly items = signal<EventListItem[]>([]);
  readonly total = signal(0);
  readonly statusFilter = signal<EventStatus | ''>('');
  readonly publishingId = signal<string | null>(null);
  readonly closingId = signal<string | null>(null);
  readonly cancellingId = signal<string | null>(null);
  readonly publishErrors = signal<{ id: string; errors: string[] } | null>(null);

  readonly statusOptions: Array<{ value: EventStatus | ''; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'Draft', label: 'Rascunho' },
    { value: 'Published', label: 'Publicado' },
    { value: 'Closed', label: 'Encerrado' },
    { value: 'Cancelled', label: 'Cancelado' },
  ];

  ngOnInit(): void {
    void this.load();
  }

  onStatusChange(value: EventStatus | ''): void {
    this.statusFilter.set(value);
    void this.load();
  }

  openEventRoute(id: string): string {
    return `${this.homeRoute}/eventos/${id}/continuar`;
  }

  registrationsRoute(id: string): string {
    return `${this.homeRoute}/eventos/${id}/inscritos`;
  }

  canViewRegistrations(status: EventStatus): boolean {
    return status === 'Published' || status === 'Closed' || status === 'Cancelled';
  }

  statusLabel(status: EventStatus): string {
    return this.statusOptions.find((o) => o.value === status)?.label ?? status;
  }

  canPublish(status: EventStatus): boolean {
    return status === 'Draft' || status === 'Published';
  }

  canClose(status: EventStatus): boolean {
    return status === 'Published';
  }

  canCancel(status: EventStatus): boolean {
    return status === 'Draft' || status === 'Published' || status === 'Closed';
  }

  isBusy(id: string): boolean {
    return (
      this.publishingId() === id || this.closingId() === id || this.cancellingId() === id
    );
  }

  dismissPublishErrors(): void {
    this.publishErrors.set(null);
  }

  async publish(id: string): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.publishErrors.set(null);
    this.publishingId.set(id);
    try {
      const updated = await firstValueFrom(this.eventsApi.publish(id)).catch((err) =>
        mapPublishHttpError(err)
      );
      this.successMessage.set(`"${updated.name}" publicado com sucesso.`);
      await this.load();
    } catch (error) {
      if (error instanceof PublishValidationError) {
        this.publishErrors.set({ id, errors: error.errors });
      } else {
        this.errorMessage.set(getAuthErrorMessage(error));
      }
    } finally {
      this.publishingId.set(null);
    }
  }

  async close(id: string, name: string): Promise<void> {
    if (
      !confirm(
        `Encerrar inscrições de "${name}"? Novas inscrições serão bloqueadas.`
      )
    ) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.publishErrors.set(null);
    this.closingId.set(id);
    try {
      const updated = await firstValueFrom(this.eventsApi.close(id)).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível encerrar as inscrições.')
      );
      this.successMessage.set(`Inscrições de "${updated.name}" encerradas.`);
      await this.load();
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.closingId.set(null);
    }
  }

  async cancel(id: string, name: string): Promise<void> {
    if (
      !confirm(
        `Cancelar o evento "${name}"?\n\nEsta ação não pode ser desfeita. O evento deixará de aparecer publicamente e não poderá ser editado.`
      )
    ) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.publishErrors.set(null);
    this.cancellingId.set(id);
    try {
      const updated = await firstValueFrom(this.eventsApi.cancel(id)).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível cancelar o evento.')
      );
      this.successMessage.set(`"${updated.name}" foi cancelado.`);
      await this.load();
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.cancellingId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const status = this.statusFilter();
      const page = await firstValueFrom(
        this.eventsApi.listMine({
          status: status || null,
          skip: 0,
          take: 50,
          sort: '-updatedAtUtc',
        })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível listar seus eventos.'));

      this.items.set(page.items);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.items.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }
}
