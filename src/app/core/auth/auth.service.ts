import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { mapAuthHttpError, mapLoginHttpError } from './auth-http.util';
import { InvalidCredentialsError } from './auth.errors';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user.model';
import { CompleteProfileRequest } from '../models/complete-profile.model';
import { RegisterRequest } from '../models/register.model';
import { AuthApiService } from './auth-api.service';
import { findMockAccount, findMockAccountByToken } from './auth-mock.data';
import { decodeJwtPayload } from './jwt.util';
import { buildGoogleLoginUrl } from './google-auth.util';
import { TokenStorageService } from './token-storage.service';
import {
  USER_HOME_ROUTE,
  defaultHomeFor,
  isDefaultReturnUrl,
} from '../routing/app-routes';

export { InvalidCredentialsError } from './auth.errors';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(null);

  readonly currentUser = this.userSignal.asReadonly();

  readonly isAuthenticated = computed(
    () => this.userSignal() !== null || !!this.tokenStorage.getAccessToken()
  );

  /** Perfil completo o suficiente para inscrição/criação de evento. */
  readonly profileComplete = computed(() => this.userSignal()?.profileComplete ?? false);

  async initialize(): Promise<void> {
    const token = this.tokenStorage.getAccessToken();
    if (!token) {
      return;
    }
    await this.hydrateUserFromToken(token);
  }

  loginWithGoogle(returnUrl = USER_HOME_ROUTE): void {
    if (environment.useAuthMock || environment.useAuthMockGoogle) {
      this.completeMockGoogleLogin(returnUrl);
      return;
    }

    window.location.href = buildGoogleLoginUrl(returnUrl);
  }

  /** Login por e-mail OU CPF. */
  async loginWithIdentifier(
    identifier: string,
    password: string,
    returnUrl = USER_HOME_ROUTE
  ): Promise<void> {
    if (environment.useAuthMock) {
      const account = findMockAccount(identifier, password);
      if (!account) {
        throw new InvalidCredentialsError();
      }
      this.establishSession(account.token, account.user);
      await this.navigateAfterLogin(returnUrl);
      return;
    }

    const response = await firstValueFrom(
      this.authApi
        .loginWithCredentials({ identifier: identifier.trim(), password })
        .pipe(catchError((err) => mapLoginHttpError(err)))
    );
    await this.completeLogin(response.accessToken, returnUrl);
  }

  /**
   * Cadastra um novo usuário. NÃO autentica: o fluxo segue para a tela de login.
   */
  async register(request: RegisterRequest): Promise<void> {
    await firstValueFrom(
      this.authApi
        .register(request)
        .pipe(
          catchError((err) =>
            mapAuthHttpError(err, 'Não foi possível criar a conta. Tente novamente.')
          )
        )
    );
  }

  async completeLogin(token: string, returnUrl = '/'): Promise<void> {
    this.tokenStorage.setAccessToken(token);
    await this.hydrateUserFromToken(token);
    await this.navigateAfterLogin(returnUrl);
  }

  /** Completa/atualiza o perfil do usuário autenticado (PATCH /api/me/profile). */
  async completeProfile(request: CompleteProfileRequest): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.authApi
        .completeProfile(request)
        .pipe(
          catchError((err) =>
            mapAuthHttpError(err, 'Não foi possível salvar o perfil. Tente novamente.')
          )
        )
    );
    this.userSignal.set(user);
    return user;
  }

  logout(): void {
    this.tokenStorage.clearAccessToken();
    this.userSignal.set(null);
    void this.router.navigate(['/auth/login']);
  }

  private establishSession(token: string, user: AuthUser): void {
    this.tokenStorage.setAccessToken(token);
    this.userSignal.set(user);
  }

  private async navigateAfterLogin(returnUrl: string): Promise<void> {
    const user = this.userSignal();
    const target = isDefaultReturnUrl(returnUrl) ? defaultHomeFor(user) : returnUrl;
    await this.router.navigateByUrl(target);
  }

  private async hydrateUserFromToken(token: string): Promise<void> {
    if (environment.useAuthMock && token.startsWith('dev-mock.')) {
      const account = findMockAccountByToken(token);
      if (account) {
        this.userSignal.set(account.user);
        return;
      }
    }

    try {
      const user = await firstValueFrom(this.authApi.getCurrentUser());
      this.userSignal.set(user);
    } catch {
      const user = this.userFromJwt(token);
      if (user) {
        this.userSignal.set(user);
      } else {
        this.tokenStorage.clearAccessToken();
        this.userSignal.set(null);
      }
    }
  }

  private userFromJwt(token: string): AuthUser | null {
    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email ?? '',
      name: payload.name ?? payload.email ?? 'Usuário',
      pictureUrl: payload.picture ?? null,
      accountType: (payload.account_type as AuthUser['accountType']) ?? null,
      profileComplete: payload.profile_complete === 'true',
    };
  }

  private completeMockGoogleLogin(returnUrl: string): void {
    const account = findMockAccount('usuario@dev.local', 'Usuario@123');
    if (!account) {
      return;
    }
    this.establishSession(account.token, account.user);
    void this.navigateAfterLogin(returnUrl);
  }
}
