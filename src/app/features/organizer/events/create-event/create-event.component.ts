import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { AuthService } from '../../../../core/auth/auth.service';
import { EventsApiService } from '../../../../core/events/events-api.service';
import {
  createDisabledModules,
  CreateEventRequest,
  SPORT_TYPE_OPTIONS,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

/** UC-37 — criação mínima: o resto do cadastro é feito pelo painel do evento. */
@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './create-event.component.html',
  styleUrl: './create-event.component.scss',
})
export class CreateEventComponent {
  private readonly auth = inject(AuthService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly sportTypes = SPORT_TYPE_OPTIONS;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canCreate = computed(() => {
    const user = this.auth.currentUser();
    return !!user && user.profileComplete === true && user.accountType === 'Organizer';
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    sportType: ['Running', [Validators.required]],
    startsAtLocal: ['', [Validators.required]],
    venueName: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required, Validators.maxLength(2)]],
  });

  cancel(): void {
    void this.router.navigateByUrl(`${this.homeRoute}/eventos`);
  }

  async create(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.canCreate()) {
      this.errorMessage.set(
        'Apenas organizadores com perfil completo podem criar eventos. Complete o perfil com CNPJ.'
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const created = await firstValueFrom(this.eventsApi.create(this.buildRequest())).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível criar o evento.')
      );
      await this.router.navigateByUrl(`${this.homeRoute}/eventos/${created.id}`);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private buildRequest(): CreateEventRequest {
    const value = this.form.getRawValue();
    const user = this.auth.currentUser();
    return {
      name: value.name.trim(),
      slug: null,
      sportType: value.sportType,
      startsAt: this.toIsoUtc(value.startsAtLocal),
      timezone: 'America/Sao_Paulo',
      venueName: value.venueName.trim() || null,
      address: {
        city: value.city.trim() || null,
        state: value.state.trim().toUpperCase() || null,
        country: 'Brasil',
      },
      categories: [],
      // Pré-preenche com o contato do organizador; editável em Informações gerais.
      contactEmail: user?.email ?? null,
      contactPhone: user?.phone ?? null,
      modules: createDisabledModules(),
    };
  }

  private toIsoUtc(localValue: string): string | null {
    if (!localValue?.trim()) {
      return null;
    }
    const date = new Date(localValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }
}
