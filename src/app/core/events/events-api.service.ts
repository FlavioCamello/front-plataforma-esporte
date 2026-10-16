import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateEventRequest,
  EventDetail,
  ListMyEventsParams,
  PagedEventList,
  UpdateEventRequest,
} from '../models/event.model';
import { normalizeApiBaseUrl } from '../auth/api-base.util';

@Injectable({ providedIn: 'root' })
export class EventsApiService {
  private readonly baseUrl = normalizeApiBaseUrl(environment.apiUrl);

  constructor(private readonly http: HttpClient) {}

  create(request: CreateEventRequest): Observable<EventDetail> {
    return this.http.post<EventDetail>(`${this.baseUrl}${environment.eventsPath}`, request);
  }

  listMine(params: ListMyEventsParams = {}): Observable<PagedEventList> {
    let httpParams = new HttpParams();
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
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

    return this.http.get<PagedEventList>(`${this.baseUrl}${environment.eventsPath}/mine`, {
      params: httpParams,
    });
  }

  getById(id: string): Observable<EventDetail> {
    return this.http.get<EventDetail>(`${this.baseUrl}${environment.eventsPath}/${id}`);
  }

  update(id: string, request: UpdateEventRequest): Observable<EventDetail> {
    return this.http.patch<EventDetail>(`${this.baseUrl}${environment.eventsPath}/${id}`, request);
  }

  publish(id: string): Observable<EventDetail> {
    return this.http.post<EventDetail>(
      `${this.baseUrl}${environment.eventsPath}/${id}/publish`,
      {}
    );
  }

  close(id: string): Observable<EventDetail> {
    return this.http.post<EventDetail>(
      `${this.baseUrl}${environment.eventsPath}/${id}/close`,
      {}
    );
  }

  cancel(id: string): Observable<EventDetail> {
    return this.http.post<EventDetail>(
      `${this.baseUrl}${environment.eventsPath}/${id}/cancel`,
      {}
    );
  }
}
