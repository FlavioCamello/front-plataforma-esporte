import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';

/**
 * UC-36 — compat: redireciona retorno antigo do Checkout Pro para Minhas inscrições.
 * back_urls novas já apontam direto para /home/inscricoes?payment=…
 */
@Component({
  selector: 'app-event-registration-return',
  standalone: true,
  template: `<p class="redirect">Redirecionando…</p>`,
  styles: `
    .redirect {
      padding: 2rem 1.25rem;
      text-align: center;
      font-family: var(--brand-font-body, sans-serif);
      color: var(--brand-ink, #0b1412);
    }
  `,
})
export class EventRegistrationReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const status = (this.route.snapshot.queryParamMap.get('status') ?? 'pending').toLowerCase();
    const registrationId = this.route.snapshot.queryParamMap.get('registrationId');
    const payment =
      status === 'success' || status === 'failure' || status === 'pending' ? status : 'pending';

    void this.router.navigate([`${USER_HOME_ROUTE}/inscricoes`], {
      replaceUrl: true,
      queryParams: {
        payment,
        ...(registrationId ? { registrationId } : {}),
      },
    });
  }
}
