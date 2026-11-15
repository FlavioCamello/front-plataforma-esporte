import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { EventsApiService } from '../../../../core/events/events-api.service';
import { ImageUploadService } from '../../../../core/events/image-upload.service';
import {
  CATEGORY_GENDER_OPTIONS,
  CategoryGender,
  EventDetail,
  EventModules,
  SHIRT_SIZE_CATALOG,
  SPORT_TYPE_OPTIONS,
  UpdateEventRequest,
  createDisabledModules,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';
import { MarkdownEditorComponent } from '../../../../shared/markdown-editor/markdown-editor.component';

/** Seções do painel (UC-37) editadas por este componente; provas têm tela própria. */
export type EventSectionKey = 'general' | 'content' | 'categories' | 'kit' | 'settings';

const SECTION_TITLES: Record<EventSectionKey, { title: string; subtitle: string }> = {
  general: {
    title: 'Informações gerais',
    subtitle: 'Nome, data, local, capa, prazo de inscrição, vagas e contato',
  },
  content: {
    title: 'Conteúdo',
    subtitle: 'Descrição, percurso, regulamento e seções personalizadas',
  },
  categories: {
    title: 'Categorias',
    subtitle: 'Opções de inscrição por gênero, idade e desconto',
  },
  kit: {
    title: 'Kit do atleta',
    subtitle: 'Itens do kit, tamanhos de camiseta e retirada',
  },
  settings: {
    title: 'Configurações',
    subtitle: 'Site e redes sociais do evento',
  },
};

/** Campos do PATCH que cada seção envia — o resto do evento não é tocado. */
const SECTION_REQUEST_KEYS: Record<EventSectionKey, Array<keyof UpdateEventRequest>> = {
  general: [
    'name',
    'sportType',
    'bannerUrl',
    'startsAt',
    'endsAt',
    'registrationClosesAt',
    'venueName',
    'address',
    'contactEmail',
    'contactPhone',
    'capacity',
    'mapUrl',
  ],
  content: ['description', 'regulationText', 'regulationUrl', 'customSections', 'modules'],
  categories: ['categories'],
  kit: ['modules'],
  settings: ['modules'],
};

/** Com o evento encerrado o back só aceita conteúdo informativo. */
const CLOSED_REQUEST_KEYS: Array<keyof UpdateEventRequest> = [
  'description',
  'contactEmail',
  'contactPhone',
  'customSections',
];

const SECTION_CONTROLS: Record<EventSectionKey, string[]> = {
  general: [
    'name',
    'sportType',
    'startsAtLocal',
    'endsAtLocal',
    'registrationClosesAtLocal',
    'venueName',
    'street',
    'number',
    'complement',
    'neighborhood',
    'city',
    'state',
    'country',
    'capacity',
    'mapUrl',
    'contactEmail',
    'contactPhone',
  ],
  content: ['description', 'routeDescription', 'regulationText', 'regulationUrl', 'customSections'],
  categories: ['categories'],
  kit: ['kitItemsText', 'kitExtrasNote', 'shirtMeasurementHint', 'kitPickupDescription'],
  settings: ['websiteUrl', 'instagramUrl'],
};

const SUGGESTED_SECTIONS = [
  'Programação',
  'Premiação',
  'Entrega de kits',
  'Inscrições',
  'Curiosidades',
] as const;

@Component({
  selector: 'app-event-section',
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
    MatSlideToggleModule,
    MatCheckboxModule,
    MarkdownEditorComponent,
  ],
  templateUrl: './event-section.component.html',
  styleUrl: './event-section.component.scss',
})
export class EventSectionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);
  private readonly imageUpload = inject(ImageUploadService);
  private readonly fb = inject(FormBuilder);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly sportTypes = SPORT_TYPE_OPTIONS;
  readonly genderOptions = CATEGORY_GENDER_OPTIONS;
  readonly shirtCatalog = SHIRT_SIZE_CATALOG;

  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly section: EventSectionKey =
    (this.route.snapshot.data['section'] as EventSectionKey | undefined) ?? 'general';
  readonly sectionInfo = SECTION_TITLES[this.section];
  readonly dashboardPath = `${USER_HOME_ROUTE}/eventos/${this.eventId}`;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly event = signal<EventDetail | null>(null);

  /** label → medidas opcionais (cm). A presença da chave indica tamanho selecionado. */
  readonly shirtSizes = signal<Record<string, { widthCm: number | null; heightCm: number | null }>>(
    {}
  );
  readonly bannerPreview = signal<string | null>(null);
  readonly bannerFileName = signal<string | null>(null);
  readonly bannerCleared = signal(false);
  private bannerFile: File | null = null;

  readonly regulationFileName = signal<string | null>(null);
  private regulationFile: File | null = null;

  readonly isCancelled = computed(() => this.event()?.status === 'Cancelled');
  readonly isClosed = computed(() => this.event()?.status === 'Closed');
  readonly canEditCategories = computed(() => !this.isClosed() && !this.isCancelled());
  readonly canEditModules = computed(() => !this.isClosed() && !this.isCancelled());
  /** Seções sem nenhum campo editável com o evento encerrado. */
  readonly lockedWhenClosed = computed(
    () => this.isClosed() && (this.section === 'categories' || this.section === 'kit' || this.section === 'settings')
  );
  readonly canSave = computed(() => !this.isCancelled() && !this.lockedWhenClosed());
  readonly suggestionPickerOpen = signal(false);
  readonly suggestedSectionTitles = SUGGESTED_SECTIONS;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    sportType: ['Running', [Validators.required]],
    description: [''],
    bannerUrl: [''],
    startsAtLocal: [''],
    endsAtLocal: [''],
    registrationClosesAtLocal: [''],
    venueName: [''],
    street: [''],
    number: [''],
    complement: [''],
    neighborhood: [''],
    city: [''],
    state: ['', [Validators.maxLength(2)]],
    capacity: [null as number | null],
    mapUrl: [''],
    country: ['Brasil'],
    contactEmail: ['', [Validators.email]],
    contactPhone: [''],
    regulationText: [''],
    regulationUrl: [''],
    categories: this.fb.array([] as ReturnType<EventSectionComponent['createCategoryGroup']>[]),
    customSections: this.fb.array(
      [] as ReturnType<EventSectionComponent['createCustomSectionGroup']>[]
    ),
    routeEnabled: [false],
    routeDescription: [''],
    kitEnabled: [false],
    kitItemsText: [''],
    kitExtrasNote: [''],
    shirtEnabled: [false],
    shirtMeasurementHint: [''],
    kitPickupEnabled: [false],
    kitPickupDescription: [''],
    socialEnabled: [false],
    websiteUrl: [''],
    instagramUrl: [''],
  });

  get categories(): FormArray {
    return this.form.controls.categories;
  }

  get customSections(): FormArray {
    return this.form.controls.customSections;
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.revokeBannerPreview();
  }

  bannerDisplayImage(): string | null {
    return this.bannerPreview() || this.form.controls.bannerUrl.value || null;
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
    this.bannerCleared.set(false);
    input.value = '';
  }

  clearBanner(): void {
    this.revokeBannerPreview();
    this.bannerFileName.set(null);
    this.bannerFile = null;
    this.form.controls.bannerUrl.setValue('');
    this.bannerCleared.set(true);
  }

  onRegulationSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validationError = this.imageUpload.validate('regulation', file);
    if (validationError) {
      this.errorMessage.set(validationError);
      input.value = '';
      return;
    }

    this.errorMessage.set(null);
    this.regulationFile = file;
    this.regulationFileName.set(file.name);
    input.value = '';
  }

  clearRegulationFile(): void {
    this.regulationFile = null;
    this.regulationFileName.set(null);
  }

  isShirtSelected(label: string): boolean {
    return label in this.shirtSizes();
  }

  toggleShirtSize(label: string, checked: boolean): void {
    const next = { ...this.shirtSizes() };
    if (checked) {
      if (!(label in next)) {
        next[label] = { widthCm: null, heightCm: null };
      }
    } else {
      delete next[label];
    }
    this.shirtSizes.set(next);
  }

  shirtDim(label: string, dim: 'widthCm' | 'heightCm'): number | null {
    return this.shirtSizes()[label]?.[dim] ?? null;
  }

  setShirtDim(label: string, dim: 'widthCm' | 'heightCm', raw: string): void {
    const current = this.shirtSizes()[label];
    if (!current) {
      return;
    }
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    this.shirtSizes.set({
      ...this.shirtSizes(),
      [label]: {
        ...current,
        [dim]: parsed == null || Number.isNaN(parsed) ? null : parsed,
      },
    });
  }

  addCategory(): void {
    this.categories.push(this.createCategoryGroup());
  }

  removeCategory(index: number): void {
    this.categories.removeAt(index);
  }

  addCustomSection(title?: string): void {
    if (this.customSections.length >= 8) {
      this.errorMessage.set('Máximo de 8 seções personalizadas.');
      return;
    }
    this.customSections.push(this.createCustomSectionGroup({ title }));
    this.suggestionPickerOpen.set(false);
  }

  toggleSuggestionPicker(): void {
    this.suggestionPickerOpen.update((open) => !open);
  }

  availableSuggestions(): string[] {
    const used = new Set(
      this.customSections.controls
        .map((ctrl) => String(ctrl.get('title')?.value ?? '').trim().toLowerCase())
        .filter(Boolean)
    );
    return SUGGESTED_SECTIONS.filter((title) => !used.has(title.toLowerCase()));
  }

  removeCustomSection(index: number): void {
    this.customSections.removeAt(index);
  }

  async save(): Promise<void> {
    const updated = await this.persist();
    if (updated) {
      void this.router.navigateByUrl(this.dashboardPath);
    }
  }

  backToDashboard(): void {
    void this.router.navigateByUrl(this.dashboardPath);
  }

  private async persist(): Promise<EventDetail | null> {
    this.errorMessage.set(null);

    if (this.isCancelled()) {
      this.errorMessage.set('Evento cancelado não pode ser editado.');
      return null;
    }

    const controls = this.sectionControls();
    if (controls.some((c) => c.invalid)) {
      controls.forEach((c) => c.markAllAsTouched());
      return null;
    }

    this.saving.set(true);
    try {
      if (this.section === 'general' && this.bannerFile) {
        const bannerUrl = await this.imageUpload.upload(this.eventId, 'banner', this.bannerFile);
        this.form.controls.bannerUrl.setValue(bannerUrl);
        this.bannerCleared.set(false);
        this.bannerFile = null;
      }

      if (this.section === 'content' && this.regulationFile) {
        const regulationUrl = await this.imageUpload.upload(
          this.eventId,
          'regulation',
          this.regulationFile
        );
        this.form.controls.regulationUrl.setValue(regulationUrl);
        this.regulationFile = null;
      }

      const updated = await firstValueFrom(
        this.eventsApi.update(this.eventId, this.buildSectionRequest())
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível salvar o evento.'));

      this.event.set(updated);
      this.patchForm(updated);
      return updated;
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  private sectionControls(): AbstractControl[] {
    const controls = this.form.controls as Record<string, AbstractControl>;
    return SECTION_CONTROLS[this.section].map((name) => controls[name]);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const detail = await firstValueFrom(this.eventsApi.getById(this.eventId)).catch((err) =>
        mapAuthHttpError(err, 'Não foi possível carregar o evento.')
      );
      this.event.set(detail);
      this.patchForm(detail);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private patchForm(detail: EventDetail): void {
    this.revokeBannerPreview();
    this.bannerFileName.set(null);
    this.bannerCleared.set(false);
    this.regulationFileName.set(null);
    this.regulationFile = null;

    this.form.patchValue({
      name: detail.name,
      sportType: detail.sportType,
      description: detail.description ?? '',
      bannerUrl: detail.bannerUrl ?? '',
      startsAtLocal: this.toLocalInput(detail.startsAt),
      endsAtLocal: this.toLocalInput(detail.endsAt),
      registrationClosesAtLocal: this.toLocalInput(detail.registrationClosesAt),
      capacity: detail.capacity ?? null,
      mapUrl: detail.mapUrl ?? '',
      venueName: detail.venueName ?? '',
      street: detail.address?.street ?? '',
      number: detail.address?.number ?? '',
      complement: detail.address?.complement ?? '',
      neighborhood: detail.address?.neighborhood ?? '',
      city: detail.address?.city ?? '',
      state: detail.address?.state ?? '',
      country: detail.address?.country || 'Brasil',
      contactEmail: detail.contactEmail ?? '',
      contactPhone: detail.contactPhone ?? '',
      regulationText: detail.regulationText ?? '',
      regulationUrl: detail.regulationUrl ?? '',
      routeEnabled: detail.modules.route.enabled,
      routeDescription: detail.modules.route.description ?? '',
      kitEnabled: detail.modules.athleteKit.enabled,
      kitItemsText: detail.modules.athleteKit.items.join('\n'),
      kitExtrasNote: detail.modules.athleteKit.extrasNote ?? '',
      shirtEnabled: detail.modules.shirtSizeChart.enabled,
      shirtMeasurementHint: detail.modules.shirtSizeChart.measurementHint ?? '',
      kitPickupEnabled: detail.modules.kitPickup.enabled,
      kitPickupDescription: detail.modules.kitPickup.description ?? '',
      socialEnabled: detail.modules.socialLinks.enabled,
      websiteUrl: detail.modules.socialLinks.websiteUrl ?? '',
      instagramUrl: detail.modules.socialLinks.instagramUrl ?? '',
    });

    this.categories.clear();
    for (const category of detail.categories) {
      this.categories.push(
        this.createCategoryGroup({
          id: category.id,
          name: category.name,
          gender: category.gender,
          minAge: category.minAge ?? null,
          maxAge: category.maxAge ?? null,
          discountPercent: category.discountPercent ?? null,
          capacity: category.capacity ?? null,
          registrationOpensAt: category.registrationOpensAt ?? null,
          registrationClosesAt: category.registrationClosesAt ?? null,
        })
      );
    }

    this.customSections.clear();
    for (const section of detail.customSections ?? []) {
      this.customSections.push(
        this.createCustomSectionGroup({
          id: section.id,
          title: section.title,
          content: section.content,
        })
      );
    }

    const shirtMap: Record<string, { widthCm: number | null; heightCm: number | null }> = {};
    for (const size of detail.modules.shirtSizeChart.sizes) {
      shirtMap[size.label] = {
        widthCm: size.widthCm ?? null,
        heightCm: size.heightCm ?? null,
      };
    }
    this.shirtSizes.set(shirtMap);

    if (this.isCancelled()) {
      this.form.disable({ emitEvent: false });
    } else if (this.isClosed()) {
      this.form.enable({ emitEvent: false });
      const locked = [
        'name',
        'sportType',
        'startsAtLocal',
        'endsAtLocal',
        'registrationClosesAtLocal',
        'capacity',
        'mapUrl',
        'venueName',
        'street',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
        'country',
        'regulationText',
        'regulationUrl',
        'routeEnabled',
        'routeDescription',
        'kitEnabled',
        'shirtEnabled',
        'kitPickupEnabled',
        'socialEnabled',
      ] as const;
      for (const name of locked) {
        this.form.controls[name].disable({ emitEvent: false });
      }
      this.categories.disable({ emitEvent: false });
    }
  }

  hasCategoryAdvanced(ctrl: AbstractControl): boolean {
    const value = ctrl.getRawValue() as {
      capacity?: number | string | null;
      registrationOpensAtLocal?: string;
      registrationClosesAtLocal?: string;
    };
    const hasCapacity = value.capacity != null && value.capacity !== '';
    return (
      hasCapacity ||
      !!value.registrationOpensAtLocal ||
      !!value.registrationClosesAtLocal
    );
  }

  private createCategoryGroup(initial?: {
    id?: string;
    name?: string;
    gender?: CategoryGender;
    minAge?: number | null;
    maxAge?: number | null;
    discountPercent?: number | null;
    capacity?: number | null;
    registrationOpensAt?: string | null;
    registrationClosesAt?: string | null;
  }) {
    return this.fb.nonNullable.group({
      id: [initial?.id ?? ''],
      name: [initial?.name ?? '', Validators.required],
      gender: [initial?.gender ?? ('Open' as CategoryGender), Validators.required],
      minAge: [initial?.minAge as number | null],
      maxAge: [initial?.maxAge as number | null],
      discountPercent: [
        initial?.discountPercent as number | null,
        [Validators.min(0), Validators.max(100)],
      ],
      capacity: [initial?.capacity as number | null, [Validators.min(1)]],
      registrationOpensAtLocal: [this.toLocalInput(initial?.registrationOpensAt)],
      registrationClosesAtLocal: [this.toLocalInput(initial?.registrationClosesAt)],
    });
  }

  private createCustomSectionGroup(initial?: { id?: string; title?: string; content?: string }) {
    return this.fb.nonNullable.group({
      id: [initial?.id ?? ''],
      title: [initial?.title ?? '', [Validators.required, Validators.maxLength(80)]],
      content: [initial?.content ?? '', [Validators.required, Validators.maxLength(4000)]],
    });
  }

  private buildSectionRequest(): UpdateEventRequest {
    const full = this.buildFullRequest();
    const allowed = new Set<keyof UpdateEventRequest>(SECTION_REQUEST_KEYS[this.section]);
    if (this.isClosed()) {
      for (const key of [...allowed]) {
        if (!CLOSED_REQUEST_KEYS.includes(key)) {
          allowed.delete(key);
        }
      }
    }

    const request: UpdateEventRequest = {};
    for (const key of allowed) {
      if (key in full) {
        (request as Record<string, unknown>)[key] = full[key];
      }
    }
    return request;
  }

  private buildFullRequest(): UpdateEventRequest {
    const value = this.form.getRawValue();
    const kitEnabled = value.kitEnabled;
    const shirtEnabled = kitEnabled && value.shirtEnabled;

    const modules: EventModules = {
      ...createDisabledModules(),
      route: {
        enabled: value.routeEnabled,
        description: value.routeDescription.trim() || null,
      },
      athleteKit: {
        enabled: kitEnabled,
        items: value.kitItemsText
          .split('\n')
          .map((i) => i.trim())
          .filter((i) => i.length > 0),
        extrasNote: value.kitExtrasNote.trim() || null,
      },
      shirtSizeChart: {
        enabled: shirtEnabled,
        sizes: shirtEnabled
          ? this.shirtCatalog
              .filter((s) => this.isShirtSelected(s.label))
              .map((s) => ({
                label: s.label,
                widthCm: this.shirtDim(s.label, 'widthCm'),
                heightCm: this.shirtDim(s.label, 'heightCm'),
              }))
          : [],
        measurementHint: value.shirtMeasurementHint.trim() || null,
      },
      kitPickup: {
        enabled: value.kitPickupEnabled,
        description: value.kitPickupDescription.trim() || null,
      },
      socialLinks: {
        enabled: value.socialEnabled,
        websiteUrl: value.websiteUrl.trim() || null,
        instagramUrl: value.instagramUrl.trim() || null,
      },
      customForm: this.event()?.modules.customForm ?? { enabled: false, questions: [] },
    };

    const request: UpdateEventRequest = {
      name: value.name.trim(),
      sportType: value.sportType,
      description: value.description.trim() || null,
      startsAt: this.toIsoUtc(value.startsAtLocal),
      endsAt: this.toIsoUtc(value.endsAtLocal),
      registrationClosesAt: this.toIsoUtc(value.registrationClosesAtLocal),
      capacity:
        value.capacity == null || value.capacity === ('' as unknown) ? null : Number(value.capacity),
      mapUrl: value.mapUrl.trim() || null,
      venueName: value.venueName.trim() || null,
      address: {
        street: value.street.trim() || null,
        number: value.number.trim() || null,
        complement: value.complement.trim() || null,
        neighborhood: value.neighborhood.trim() || null,
        city: value.city.trim() || null,
        state: value.state.trim().toUpperCase() || null,
        country: value.country.trim() || 'Brasil',
      },
      contactEmail: value.contactEmail.trim() || null,
      contactPhone: value.contactPhone.trim() || null,
      regulationText: value.regulationText.trim() || null,
      regulationUrl: value.regulationUrl.trim() || null,
      modules,
    };

    // bannerUrl já foi atualizado no persist() após o upload ao S3 (se houve arquivo novo).
    if (this.bannerCleared()) {
      request.bannerUrl = null;
    } else if (value.bannerUrl.trim()) {
      request.bannerUrl = value.bannerUrl.trim();
    }

    if (this.canEditCategories()) {
      request.categories = value.categories.map((c) => {
        return {
          id: c.id || null,
          name: c.name.trim(),
          gender: c.gender,
          capacity:
            c.capacity == null || c.capacity === ('' as unknown) ? null : Number(c.capacity),
          minAge: c.minAge == null || c.minAge === ('' as unknown) ? null : Number(c.minAge),
          maxAge: c.maxAge == null || c.maxAge === ('' as unknown) ? null : Number(c.maxAge),
          discountPercent:
            c.discountPercent == null || c.discountPercent === ('' as unknown)
              ? null
              : Number(c.discountPercent),
          registrationOpensAt: this.toIsoUtc(c.registrationOpensAtLocal),
          registrationClosesAt: this.toIsoUtc(c.registrationClosesAtLocal),
        };
      });
    }

    // Seções livres: conteúdo informativo, editável mesmo com evento encerrado.
    request.customSections = value.customSections
      .map((s) => ({
        id: s.id || null,
        title: s.title.trim(),
        content: s.content.trim(),
      }))
      .filter((s) => s.title.length > 0 || s.content.length > 0);

    return request;
  }

  private toLocalInput(iso: string | null | undefined): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  private revokeBannerPreview(): void {
    const current = this.bannerPreview();
    if (current) {
      URL.revokeObjectURL(current);
      this.bannerPreview.set(null);
    }
  }
}
