import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/auth/auth.service';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="callback">
      <mat-spinner diameter="48" />
      <p>Concluindo login...</p>
    </div>
  `,
  styles: `
    .callback {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: var(--app-page-padding);
      padding-top: calc(var(--app-page-padding) + var(--app-safe-top));
      padding-bottom: calc(var(--app-page-padding) + var(--app-safe-bottom));
      box-sizing: border-box;
    }
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    void this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    const error = this.route.snapshot.queryParamMap.get('error');
    /** Padrão alinhado ao backend: `integracao-login-google.md` (v1.1). */
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? USER_HOME_ROUTE;

    if (error || !token) {
      const errorCode = error ?? 'missing_token';
      await this.router.navigate(['/auth/login'], {
        queryParams: {
          returnUrl,
          error: errorCode,
        },
      });
      return;
    }

    try {
      await this.auth.completeLogin(token, returnUrl);
    } catch {
      await this.router.navigate(['/auth/login'], {
        queryParams: {
          returnUrl,
          error: 'session_failed',
        },
      });
    }
  }
}
