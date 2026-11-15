import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { normalizeApiBaseUrl } from '../auth/api-base.util';
import {
  BrickConfig,
  CreateRegistrationRequest,
  EventFinanceDto,
  PayRegistrationRequest,
  PayRegistrationResponse,
  RegistrationCheckout,
  ListEventRegistrationsParams,
  ListMyRegistrationsParams,
  PagedEventRegistrations,
  PagedMyRegistrations,
  RegistrationDto,
} from '../models/registration.model';

@Injectable({ providedIn: 'root' })
export class RegistrationsApiService {
  private readonly baseUrl = normalizeApiBaseUrl(environment.apiUrl);

  constructor(private readonly http: HttpClient) {}

  listMine(params: ListMyRegistrationsParams = {}): Observable<PagedMyRegistrations> {
    let httpParams = new HttpParams();
    if (params.status) {
      httpParams = httpParams.set('status', String(params.status));
    }
    if (params.skip != null) {
      httpParams = httpParams.set('skip', String(params.skip));
    }
    if (params.take != null) {
      httpParams = httpParams.set('take', String(params.take));
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }

    return this.http.get<PagedMyRegistrations>(
      `${this.baseUrl}${environment.meRegistrationsPath}`,
      { params: httpParams }
    );
  }

  /** UC-25 — inscritos do evento (organizador dono). */
  listByEvent(
    eventId: string,
    params: ListEventRegistrationsParams = {}
  ): Observable<PagedEventRegistrations> {
    let httpParams = new HttpParams();
    if (params.proofId) {
      httpParams = httpParams.set('proofId', params.proofId);
    }
    if (params.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params.status) {
      httpParams = httpParams.set('status', String(params.status));
    }
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    if (params.skip != null) {
      httpParams = httpParams.set('skip', String(params.skip));
    }
    if (params.take != null) {
      httpParams = httpParams.set('take', String(params.take));
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }

    return this.http.get<PagedEventRegistrations>(
      `${this.baseUrl}${environment.eventsPath}/${eventId}/registrations`,
      { params: httpParams }
    );
  }

  /** UC-52 — resumo financeiro do evento (organizador dono). */
  getFinance(eventId: string): Observable<EventFinanceDto> {
    return this.http.get<EventFinanceDto>(
      `${this.baseUrl}${environment.eventsPath}/${eventId}/finance`
    );
  }

  brickConfig(): Observable<BrickConfig> {
    return this.http.get<BrickConfig>(`${this.baseUrl}/api/payments/brick-config`);
  }

  checkout(registrationId: string): Observable<RegistrationCheckout> {
    return this.http.get<RegistrationCheckout>(
      `${this.baseUrl}${environment.meRegistrationsPath}/${registrationId}/checkout`
    );
  }

  pay(
    eventId: string,
    registrationId: string,
    body: PayRegistrationRequest
  ): Observable<PayRegistrationResponse> {
    return this.http.post<PayRegistrationResponse>(
      `${this.baseUrl}${environment.eventsPath}/${eventId}/registrations/${registrationId}/pay`,
      body
    );
  }

  create(eventId: string, body: CreateRegistrationRequest): Observable<RegistrationDto> {
    return this.http.post<RegistrationDto>(
      `${this.baseUrl}${environment.eventsPath}/${eventId}/registrations`,
      body
    );
  }
}
