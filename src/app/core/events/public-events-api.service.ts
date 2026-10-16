import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PagedPublicEventList,
  PublicEventDetail,
} from '../models/event.model';
import { normalizeApiBaseUrl } from '../auth/api-base.util';

@Injectable({ providedIn: 'root' })
export class PublicEventsApiService {
  private readonly baseUrl = normalizeApiBaseUrl(environment.apiUrl);
  private readonly publicPath = `${environment.eventsPath}/public`;

  constructor(private readonly http: HttpClient) {}

  list(
    params: {
      skip?: number;
      take?: number;
      sort?: string;
      q?: string | null;
      city?: string | null;
      state?: string | null;
      sportType?: string | null;
    } = {}
  ): Observable<PagedPublicEventList> {
    let httpParams = new HttpParams();
    if (params.skip != null) {
      httpParams = httpParams.set('skip', String(params.skip));
    }
    if (params.take != null) {
      httpParams = httpParams.set('take', String(params.take));
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    if (params.city?.trim()) {
      httpParams = httpParams.set('city', params.city.trim());
    }
    if (params.state?.trim()) {
      httpParams = httpParams.set('state', params.state.trim());
    }
    if (params.sportType?.trim()) {
      httpParams = httpParams.set('sportType', params.sportType.trim());
    }

    return this.http.get<PagedPublicEventList>(`${this.baseUrl}${this.publicPath}`, {
      params: httpParams,
    });
  }

  getBySlug(slug: string): Observable<PublicEventDetail> {
    return this.http.get<PublicEventDetail>(
      `${this.baseUrl}${this.publicPath}/${encodeURIComponent(slug)}`
    );
  }
}
