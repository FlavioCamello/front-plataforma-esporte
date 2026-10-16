import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
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
import { ImageUploadService } from '../../../../core/events/image-upload.service';
import {
  createDisabledModules,
  CreateEventRequest,
  SPORT_TYPE_OPTIONS,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

type SaveMode = 'draft' | 'next';

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
export class CreateEventComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly eventsApi = inject(EventsApiService);
  private readonly imageUpload = inject(ImageUploadService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly sportTypes = SPORT_TYPE_OPTIONS;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly bannerPreview = signal<string | null>(null);
  readonly bannerFileName = signal<string | null>(null);
  private bannerFile: File | null = null;

  readonly canCreate = computed(() => {
    const user = this.auth.currentUser();
    return !!user && user.profileComplete === true && user.accountType === 'Organizer';
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    sportType: ['Running', [Validators.required]],
    description: [''],
    startsAtLocal: [''],
    registrationClosesAtLocal: [''],
    venueName: [''],
    street: [''],
    number: [''],
    complement: [''],
    neighborhood: [''],
    city: [''],
    state: [''],
    country: ['Brasil'],
    contactEmail: [this.auth.currentUser()?.email ?? ''],
    contactPhone: [this.auth.currentUser()?.phone ?? ''],
  });

  ngOnDestroy(): void {
    this.revokeBannerPreview();
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validationError = this.imageUpload.validate('banner', file);
    if (validationError) {
      this.errorMessage.set(validationError);
      input.value = '';
      return;
    }

    this.errorMessage.set(null);
    this.revokeBannerPreview();
    this.bannerFile = file;
    this.bannerPreview.set(URL.createObjectURL(file));
    this.bannerFileName.set(file.name);
    input.value = '';
  }

  clearBanner(): void {
    this.revokeBannerPreview();
    this.bannerFileName.set(null);
    this.bannerFile = null;
  }

  saveDraft(): void {
    void this.save('draft');
  }

  goNext(): void {
    void this.save('next');
  }

  cancel(): void {
    void this.router.navigateByUrl(this.homeRoute);
  }

  private async save(mode: SaveMode): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

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

      // Banner: o upload precisa do id do evento, então sobe após criar o rascunho.
      if (this.bannerFile) {
        const bannerUrl = await this.imageUpload.upload(created.id, 'banner', this.bannerFile);
        await firstValueFrom(this.eventsApi.update(created.id, { bannerUrl })).catch((err) =>
          mapAuthHttpError(err, 'Evento criado, mas não foi possível salvar o banner.')
        );
      }

      if (mode === 'next') {
        await this.router.navigateByUrl(`${this.homeRoute}/eventos/${created.id}/continuar`);
        return;
      }

      this.successMessage.set(
        `Rascunho salvo: "${created.name}". Você pode continuar depois pelo painel.`
      );
      this.resetForm();
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private buildRequest(): CreateEventRequest {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      slug: null,
      sportType: value.sportType,
      description: value.description.trim() || null,
      // Banner sobe via S3 depois de criar o evento (precisa do id); aqui vai null.
      bannerUrl: null,
      startsAt: this.toIsoUtc(value.startsAtLocal),
      registrationClosesAt: this.toIsoUtc(value.registrationClosesAtLocal),
      timezone: 'America/Sao_Paulo',
      venueName: value.venueName.trim() || null,
      address: {
        street: value.street.trim() || null,
        number: value.number.trim() || null,
        complement: value.complement.trim() || null,
        neighborhood: value.neighborhood.trim() || null,
        city: value.city.trim() || null,
        state: value.state.trim() || null,
        country: value.country.trim() || 'Brasil',
      },
      categories: [],
      contactEmail: value.contactEmail.trim() || null,
      contactPhone: value.contactPhone.trim() || null,
      modules: createDisabledModules(),
    };
  }

  private resetForm(): void {
    this.clearBanner();
    this.form.reset({
      name: '',
      sportType: 'Running',
      description: '',
      startsAtLocal: '',
      registrationClosesAtLocal: '',
      venueName: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      country: 'Brasil',
      contactEmail: this.auth.currentUser()?.email ?? '',
      contactPhone: this.auth.currentUser()?.phone ?? '',
    });
  }

  private revokeBannerPreview(): void {
    const current = this.bannerPreview();
    if (current) {
      URL.revokeObjectURL(current);
      this.bannerPreview.set(null);
    }
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
