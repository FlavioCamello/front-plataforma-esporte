import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user.model';
import { CompleteProfileRequest } from '../models/complete-profile.model';
import { GoogleAuthStatus } from '../models/google-auth-status.model';
import { LoginRequest, LoginResponse } from '../models/login-credentials.model';
import { RegisterRequest } from '../models/register.model';

import { normalizeApiBaseUrl } from './api-base.util';

/** Resposta da API pode vir em camelCase (padrão .NET) ou PascalCase. */
interface LoginResponseRaw {
  accessToken?: string;
  AccessToken?: string;
}

interface GoogleAuthStatusRaw {
  enabled?: boolean;
  Enabled?: boolean;
  signInCallbackPath?: string;
  SignInCallbackPath?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = normalizeApiBaseUrl(environment.apiUrl);

  constructor(private readonly http: HttpClient) {}

  getCurrentUser(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.baseUrl}/api/me`);
  }

  getGoogleAuthStatus(): Observable<GoogleAuthStatus> {
    return this.http.get<GoogleAuthStatusRaw>(`${this.baseUrl}${environment.googleAuthStatusPath}`).pipe(
      map((body) => ({
        enabled: body.enabled ?? body.Enabled ?? false,
        signInCallbackPath: body.signInCallbackPath ?? body.SignInCallbackPath ?? '/signin-google',
      }))
    );
  }

  loginWithCredentials(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponseRaw>(`${this.baseUrl}${environment.credentialsLoginPath}`, {
        identifier: request.identifier.trim(),
        password: request.password,
      })
      .pipe(map((body) => this.toLoginResponse(body)));
  }

  register(request: RegisterRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponseRaw>(`${this.baseUrl}${environment.registerPath}`, {
        name: request.name.trim(),
        email: request.email.trim(),
        password: request.password,
        confirmPassword: request.confirmPassword,
        documentType: request.documentType,
        document: this.normalizeDocument(request.documentType, request.document),
        nationality: request.nationality ?? null,
        phone: request.phone.replace(/\D/g, ''),
        gender: request.gender,
        birthDate: request.birthDate,
        companyName: request.companyName ?? null,
        responsibleDocument: request.responsibleDocument
          ? request.responsibleDocument.replace(/\D/g, '')
          : null,
      })
      .pipe(map((body) => this.toLoginResponse(body)));
  }

  completeProfile(request: CompleteProfileRequest): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.baseUrl}${environment.completeProfilePath}`, {
      documentType: request.documentType,
      document: this.normalizeDocument(request.documentType, request.document),
      nationality: request.nationality ?? null,
      phone: request.phone.replace(/\D/g, ''),
      gender: request.gender,
      birthDate: request.birthDate,
      companyName: request.companyName ?? null,
      responsibleDocument: request.responsibleDocument
        ? request.responsibleDocument.replace(/\D/g, '')
        : null,
    });
  }

  /** CPF/CNPJ são enviados apenas com dígitos; documento estrangeiro vai como digitado. */
  private normalizeDocument(documentType: string, document: string): string {
    return documentType === 'Foreign' ? document.trim() : document.replace(/\D/g, '');
  }

  private toLoginResponse(body: LoginResponseRaw): LoginResponse {
    const accessToken = body.accessToken ?? body.AccessToken;
    if (!accessToken) {
      throw new Error('Resposta inválida: accessToken ausente.');
    }
    return { accessToken };
  }
}
