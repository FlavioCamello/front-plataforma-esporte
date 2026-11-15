import { CurrencyPipe, DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../core/auth/auth-http.util';
import { RegistrationCheckout } from '../../../core/models/registration.model';
import { RegistrationsApiService } from '../../../core/registrations/registrations-api.service';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';

interface BrickFormData {
  token?: string;
  issuer_id?: string | number;
  payment_method_id?: string;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
}

interface MpBrickController {
  unmount?: () => void;
}

interface MpConstructor {
  new (publicKey: string, options: { locale: string }): {
    bricks: () => {
      create: (type: string, containerId: string, settings: unknown) => Promise<MpBrickController>;
    };
  };
}

type PayPhase = 'loading' | 'pay' | 'pix' | 'confirmed' | 'closed' | 'error';

@Component({
  selector: 'app-registration-payment',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe, MatCardModule, MatButtonModule],
  templateUrl: './registration-payment.component.html',
  styleUrl: './registration-payment.component.scss',
})
export class RegistrationPaymentComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RegistrationsApiService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly homeRegistrations = `${USER_HOME_ROUTE}/inscricoes`;
  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly registrationId = this.route.snapshot.paramMap.get('registrationId') ?? '';

  readonly phase = signal<PayPhase>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly checkout = signal<RegistrationCheckout | null>(null);
  readonly qrCode = signal<string | null>(null);
  readonly qrImage = signal<string | null>(null);
  readonly copied = signal(false);

  private brick: MpBrickController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    void this.start();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.unmountBrick();
  }

  needsTestPayerEmail(): boolean {
    return this.payableEmail(this.checkout()?.payerEmail ?? '') === null;
  }

  async copyPix(): Promise<void> {
    const code = this.qrCode();
    if (!code || !isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  private async start(): Promise<void> {
    this.phase.set('loading');
    this.errorMessage.set(null);
    try {
      const checkout = await firstValueFrom(this.api.checkout(this.registrationId)).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível abrir o pagamento.')
      );
      this.checkout.set(checkout);
      if (this.slug && checkout.eventSlug && checkout.eventSlug !== this.slug) {
        await this.router.navigate(['/e', checkout.eventSlug, 'pagamento', checkout.id], {
          replaceUrl: true,
        });
        return;
      }
      this.applyCheckout(checkout);
      if (this.phase() === 'pay') {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await this.mountBrick(checkout);
      }
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      this.phase.set('error');
    }
  }

  private applyCheckout(checkout: RegistrationCheckout): void {
    if (checkout.status === 'Confirmed') {
      this.phase.set('confirmed');
      return;
    }
    if (checkout.status === 'Cancelled') {
      this.phase.set('closed');
      return;
    }
    if (checkout.qrCode || checkout.qrCodeBase64) {
      this.showPix(checkout.qrCode, checkout.qrCodeBase64);
      return;
    }
    this.phase.set('pay');
  }

  private async mountBrick(checkout: RegistrationCheckout): Promise<void> {
    const config = await firstValueFrom(this.api.brickConfig()).catch((err) =>
      mapAuthHttpError(err, 'Não foi possível carregar o pagamento.')
    );
    if (!config.publicKey) {
      this.errorMessage.set('Pagamento ainda não está configurado.');
      this.phase.set('error');
      return;
    }

    await this.loadSdk();
    const MercadoPago = (window as Window & { MercadoPago?: MpConstructor }).MercadoPago;
    if (!MercadoPago) {
      this.errorMessage.set('Não foi possível carregar o Mercado Pago.');
      this.phase.set('error');
      return;
    }

    const mp = new MercadoPago(config.publicKey, { locale: 'pt-BR' });
    const payerEmail = this.payableEmail(checkout.payerEmail);
    this.brick = await mp.bricks().create('payment', 'paymentBrick_container', {
      initialization: {
        amount: checkout.priceSnapshot,
        ...(payerEmail ? { payer: { email: payerEmail } } : {}),
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          bankTransfer: 'all',
          maxInstallments: config.maxInstallments > 0 ? config.maxInstallments : 10,
        },
      },
      callbacks: {
        onReady: () => undefined,
        onError: () => {
          this.errorMessage.set('O formulário de pagamento falhou. Atualize a página.');
        },
        onSubmit: ({ formData }: { formData: BrickFormData }) => this.submitBrick(checkout, formData),
      },
    });
  }

  private submitBrick(checkout: RegistrationCheckout, formData: BrickFormData): Promise<void> {
    const method = (formData.payment_method_id ?? '').trim();
    this.errorMessage.set(null);
    return firstValueFrom(
      this.api.pay(checkout.eventId, checkout.id, {
        paymentMethodId: method,
        token: formData.token ?? null,
        issuerId: formData.issuer_id == null ? null : String(formData.issuer_id),
        installments: formData.installments ?? 1,
        idempotencyKey: this.newIdempotencyKey(),
        payer: {
          email: formData.payer?.email ?? null,
          identification: {
            type: formData.payer?.identification?.type ?? null,
            number: formData.payer?.identification?.number ?? null,
          },
        },
      })
    )
      .catch((err) => mapAuthHttpError(err, 'Não foi possível processar o pagamento.'))
      .then((result) => {
        if (result.status === 'Rejected') {
          throw new Error(result.message || 'Pagamento não aprovado. Confira os dados ou escolha outro meio.');
        }
        if (result.status === 'Pending') {
          this.showPix(result.qrCode, result.qrCodeBase64);
          queueMicrotask(() => this.unmountBrick());
          return;
        }
        this.phase.set('confirmed');
        void this.router.navigate([this.homeRegistrations], { queryParams: { payment: 'success' } });
      })
      .catch((error: unknown) => {
        this.errorMessage.set(getAuthErrorMessage(error));
        throw error;
      });
  }

  private showPix(qrCode?: string | null, qrBase64?: string | null): void {
    this.qrCode.set(qrCode ?? null);
    this.qrImage.set(this.toQrImage(qrBase64));
    this.phase.set('pix');
    this.startPolling();
  }

  private startPolling(): void {
    this.stopPolling();
    let ticks = 0;
    this.pollTimer = setInterval(() => {
      ticks += 1;
      if (ticks > 36) {
        this.stopPolling();
        return;
      }
      void this.refreshStatus();
    }, 5000);
  }

  private async refreshStatus(): Promise<void> {
    try {
      const checkout = await firstValueFrom(this.api.checkout(this.registrationId));
      this.checkout.set(checkout);
      if (checkout.status === 'Confirmed') {
        this.stopPolling();
        this.phase.set('confirmed');
        void this.router.navigate([this.homeRegistrations], { queryParams: { payment: 'success' } });
      } else if (checkout.status === 'Cancelled') {
        this.stopPolling();
        this.phase.set('closed');
      }
    } catch {
      // A próxima consulta tenta de novo.
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private unmountBrick(): void {
    try {
      this.brick?.unmount?.();
    } catch {
      // O container já pode ter saído da tela.
    }
    this.brick = null;
  }

  private loadSdk(): Promise<void> {
    const current = window as Window & { MercadoPago?: MpConstructor };
    if (current.MercadoPago) {
      return Promise.resolve();
    }
    const existing = this.document.querySelector('script[data-mp-sdk="1"]');
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('sdk')), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.dataset['mpSdk'] = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago.'));
      this.document.head.appendChild(script);
    });
  }

  private payableEmail(value: string): string | null {
    const email = value.trim();
    const at = email.indexOf('@');
    if (at <= 0 || at !== email.lastIndexOf('@') || at >= email.length - 1) {
      return null;
    }
    const host = email.slice(at + 1).toLowerCase();
    if (host.includes(' ') || !host.includes('.')) {
      return null;
    }
    const reserved = ['.local', '.localhost', '.test', '.example', '.invalid'];
    return reserved.some((suffix) => host.endsWith(suffix)) ? null : email;
  }

  private newIdempotencyKey(): string {
    const cryptoRef = globalThis.crypto;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
    return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private toQrImage(raw?: string | null): string | null {
    if (!raw) {
      return null;
    }
    return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
  }
}
