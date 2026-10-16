import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../../core/auth/auth-api.service';
import { getAuthErrorMessage } from '../../../core/auth/auth-http.util';
import { AuthService } from '../../../core/auth/auth.service';
import { getGoogleOAuthErrorMessage } from '../../../core/auth/google-auth.util';
import { MOCK_AUTH_ACCOUNTS } from '../../../core/auth/auth-mock.data';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';
import { environment } from '../../../../environments/environment';

/** Conta seed do backend (Development). */
const BACKEND_DEV_ACCOUNT = {
  identifier: 'usuario@plataforma.local',
  password: 'SenhaForte@123',
  label: 'Usuário dev',
} as const;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly isDevMock = environment.useAuthMock;
  readonly isGoogleMock = environment.useAuthMockGoogle;
  readonly apiUrl = environment.apiUrl;
  readonly devPasswordHint = 'SenhaForte@123';

  readonly devAccounts = environment.useAuthMock
    ? MOCK_AUTH_ACCOUNTS.map(({ email, password, user }) => ({
        identifier: email,
        password,
        label: user.name,
      }))
    : [BACKEND_DEV_ACCOUNT];

  /** null = carregando status; true/false = disponível na API */
  readonly googleEnabled = signal<boolean | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly registeredSuccess = signal(false);

  readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    this.applyOAuthErrorFromRoute();
    this.registeredSuccess.set(this.route.snapshot.queryParamMap.get('registered') === '1');
    void this.loadGoogleAuthStatus();
  }

  get returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? USER_HOME_ROUTE;
  }

  private applyOAuthErrorFromRoute(): void {
    const error = this.route.snapshot.queryParamMap.get('error');
    const message = getGoogleOAuthErrorMessage(error);
    if (message) {
      this.errorMessage.set(message);
    }
  }

  private async loadGoogleAuthStatus(): Promise<void> {
    if (environment.useAuthMockGoogle) {
      this.googleEnabled.set(true);
      return;
    }

    try {
      const status = await firstValueFrom(this.authApi.getGoogleAuthStatus());
      this.googleEnabled.set(status.enabled);
    } catch {
      this.googleEnabled.set(true);
    }
  }

  async submitCredentials(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.form.getRawValue();
    this.loading.set(true);

    try {
      await this.auth.loginWithIdentifier(identifier, password, this.returnUrl);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  signInWithGoogle(): void {
    if (this.googleEnabled() === false) {
      return;
    }
    this.errorMessage.set(null);
    this.auth.loginWithGoogle(this.returnUrl);
  }

  fillDevAccount(identifier: string, password: string): void {
    this.form.patchValue({ identifier, password });
  }
}
