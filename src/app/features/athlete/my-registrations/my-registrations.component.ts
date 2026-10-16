import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../core/auth/auth-http.util';
import { MyRegistrationDto } from '../../../core/models/registration.model';
import { RegistrationsApiService } from '../../../core/registrations/registrations-api.service';
import { PUBLIC_EVENTS_ROUTE, USER_HOME_ROUTE } from '../../../core/routing/app-routes';

@Component({
  selector: 'app-my-registrations',
  standalone: true,
  imports: [RouterLink, DatePipe, MatCardModule, MatButtonModule],
  templateUrl: './my-registrations.component.html',
  styleUrl: './my-registrations.component.scss',
})
export class MyRegistrationsComponent implements OnInit {
  private readonly api = inject(RegistrationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly publicEventsRoute = PUBLIC_EVENTS_ROUTE;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly paymentBanner = signal<string | null>(null);
  readonly items = signal<MyRegistrationDto[]>([]);
  readonly total = signal(0);

  readonly upcoming = computed(() => {
    const now = Date.now();
    return this.items().filter((item) => {
      if (!item.startsAt) {
        return item.status !== 'Cancelled';
      }
      return new Date(item.startsAt).getTime() >= now && item.status !== 'Cancelled';
    });
  });

  readonly past = computed(() => {
    const now = Date.now();
    return this.items().filter((item) => {
      if (item.status === 'Cancelled') {
        return true;
      }
      if (!item.startsAt) {
        return false;
      }
      return new Date(item.startsAt).getTime() < now;
    });
  });

  ngOnInit(): void {
    this.readPaymentQuery();
    void this.load();
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'Confirmed':
        return 'Confirmada';
      case 'Pending':
        return 'Aguardando pagamento';
      case 'Cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  eventLink(item: MyRegistrationDto): string[] | null {
    return item.eventSlug ? ['/e', item.eventSlug] : null;
  }

  resumeCheckout(item: MyRegistrationDto): void {
    if (!item.checkoutUrl || !isPlatformBrowser(this.platformId)) {
      return;
    }
    window.location.href = item.checkoutUrl;
  }

  private readPaymentQuery(): void {
    const payment = (this.route.snapshot.queryParamMap.get('payment') ?? '').toLowerCase();
    switch (payment) {
      case 'success':
        this.paymentBanner.set(
          'Pagamento recebido. Se estiver tudo certo, sua inscrição será confirmada em instantes — atualize a lista se ainda estiver pendente.'
        );
        break;
      case 'failure':
        this.paymentBanner.set(
          'Pagamento não concluído. Você pode tentar de novo pelo botão Pagar nas inscrições pendentes.'
        );
        break;
      case 'pending':
        this.paymentBanner.set(
          'Pagamento em processamento. Atualize esta página em alguns instantes.'
        );
        break;
      default:
        this.paymentBanner.set(null);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const page = await firstValueFrom(
        this.api.listMine({ skip: 0, take: 50, sort: 'startsAt' })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível carregar suas inscrições.'));

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
