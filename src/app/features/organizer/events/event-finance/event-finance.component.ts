import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { EventsApiService } from '../../../../core/events/events-api.service';
import { EventDetail } from '../../../../core/models/event.model';
import { EventFinanceDto, FinanceBreakdownDto } from '../../../../core/models/registration.model';
import { RegistrationsApiService } from '../../../../core/registrations/registrations-api.service';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

interface FinanceSection {
  key: string;
  title: string;
  icon: string;
  rows: FinanceBreakdownDto[];
}

@Component({
  selector: 'app-event-finance',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, MatButtonModule, MatIconModule],
  templateUrl: './event-finance.component.html',
  styleUrl: './event-finance.component.scss',
})
export class EventFinanceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsApi = inject(EventsApiService);
  private readonly registrationsApi = inject(RegistrationsApiService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly event = signal<EventDetail | null>(null);
  readonly finance = signal<EventFinanceDto | null>(null);

  eventPath = `${USER_HOME_ROUTE}/eventos`;

  readonly isEmpty = computed(() => {
    const f = this.finance();
    return !!f && f.confirmedCount === 0 && f.pendingCount === 0;
  });

  readonly sections = computed<FinanceSection[]>(() => {
    const f = this.finance();
    if (!f) {
      return [];
    }
    return [
      { key: 'proof', title: 'Por prova', icon: 'route', rows: f.byProof },
      { key: 'lot', title: 'Por lote', icon: 'local_activity', rows: f.byLot },
      { key: 'category', title: 'Por categoria', icon: 'groups', rows: f.byCategory },
    ].filter((s) => s.rows.length > 0);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.eventPath = `${USER_HOME_ROUTE}/eventos/${id}`;
    void this.load(id);
  }

  /** Largura da barra relativa à maior linha do corte (R$; se tudo gratuito, quantidade). */
  barPercent(row: FinanceBreakdownDto, rows: FinanceBreakdownDto[]): number {
    const byAmount = rows.some((r) => r.confirmedAmount + r.pendingAmount > 0);
    const value = (r: FinanceBreakdownDto) =>
      byAmount ? r.confirmedAmount + r.pendingAmount : r.confirmedCount + r.pendingCount;
    const max = Math.max(...rows.map(value));
    return max > 0 ? (value(row) / max) * 100 : 0;
  }

  /** Parte confirmada dentro da barra (o resto é "a receber"). */
  confirmedShare(row: FinanceBreakdownDto, rows: FinanceBreakdownDto[]): number {
    const byAmount = rows.some((r) => r.confirmedAmount + r.pendingAmount > 0);
    const total = byAmount
      ? row.confirmedAmount + row.pendingAmount
      : row.confirmedCount + row.pendingCount;
    const confirmed = byAmount ? row.confirmedAmount : row.confirmedCount;
    return total > 0 ? (confirmed / total) * 100 : 0;
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [detail, finance] = await Promise.all([
        firstValueFrom(this.eventsApi.getById(id)).catch((err) =>
          mapAuthHttpError(err, 'Evento não encontrado.')
        ),
        firstValueFrom(this.registrationsApi.getFinance(id)).catch((err) =>
          mapAuthHttpError(err, 'Não foi possível carregar o financeiro.')
        ),
      ]);
      this.event.set(detail);
      this.finance.set(finance);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
