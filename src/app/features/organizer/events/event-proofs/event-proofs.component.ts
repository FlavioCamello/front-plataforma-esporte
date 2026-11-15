import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { getAuthErrorMessage, mapAuthHttpError } from '../../../../core/auth/auth-http.util';
import { EventsApiService } from '../../../../core/events/events-api.service';
import { ImageUploadService } from '../../../../core/events/image-upload.service';
import { EventDetail, UpdateEventRequest } from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

@Component({
  selector: 'app-event-proofs',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  templateUrl: './event-proofs.component.html',
  styleUrl: './event-proofs.component.scss',
})
export class EventProofsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);
  private readonly imageUpload = inject(ImageUploadService);
  private readonly fb = inject(FormBuilder);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly homeRoute = USER_HOME_ROUTE;
  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly event = signal<EventDetail | null>(null);

  /** index → object URL local da arte do percurso (preview antes do upload). */
  readonly routeImagePreviews = signal<Record<number, string>>({});
  readonly routeImageFileNames = signal<Record<number, string>>({});
  /** index → arquivo escolhido, ainda não enviado ao S3. */
  private routeImageFiles: Record<number, File> = {};

  readonly isCancelled = computed(() => this.event()?.status === 'Cancelled');
  readonly isClosed = computed(() => this.event()?.status === 'Closed');
  readonly canEdit = computed(() => !this.isClosed() && !this.isCancelled());
  readonly eventCategories = computed(() => this.event()?.categories ?? []);
  readonly usedLotIds = computed(() => {
    const ids = new Set<string>();
    for (const proof of this.event()?.proofs ?? []) {
      for (const lot of proof.lots ?? []) {
        if (lot.id && lot.hasRegistrations) {
          ids.add(lot.id);
        }
      }
    }
    return ids;
  });
  readonly copyPickerIndex = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    proofs: this.fb.array([] as ReturnType<EventProofsComponent['createProofGroup']>[]),
  });

  get proofs(): FormArray {
    return this.form.controls.proofs;
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.revokeAllPreviews();
  }

  dashboardPath(): string {
    return `${this.homeRoute}/eventos/${this.eventId}`;
  }

  categoriesPath(): string {
    return `${this.dashboardPath()}/categorias`;
  }

  addProof(): void {
    const allIds = this.eventCategories().map((c) => c.id);
    this.proofs.push(
      this.createProofGroup({
        categoryIds: allIds,
        lots: [{ name: '1º lote', price: 0 }],
      })
    );
    this.revealProof(this.proofs.length - 1);
  }

  /** A prova nova nasce no fim da lista; sem isso o botão fica no topo e ela passa despercebida. */
  private revealProof(index: number): void {
    if (!this.isBrowser) {
      return;
    }
    setTimeout(() => {
      const block = this.doc.getElementById(`proof-${index}`);
      block?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const name = block?.querySelector('input');
      if (name instanceof HTMLInputElement) {
        name.focus();
      }
    });
  }

  removeProof(index: number): void {
    if (this.proofHasRegisteredLots(index)) {
      this.errorMessage.set(
        'Não é possível remover esta prova: já existem inscrições em um dos lotes.'
      );
      return;
    }
    this.clearPreview(index);
    this.proofs.removeAt(index);
    this.reindexPreviewsAfterRemove(index);
    if (this.copyPickerIndex() === index) {
      this.copyPickerIndex.set(null);
    }
  }

  lotsOf(proofIndex: number): FormArray {
    return this.proofs.at(proofIndex).get('lots') as FormArray;
  }

  addLot(proofIndex: number): void {
    const lots = this.lotsOf(proofIndex);
    const n = lots.length + 1;
    lots.push(this.createLotGroup({ name: `${n}º lote`, price: 0 }));
  }

  removeLot(proofIndex: number, lotIndex: number): void {
    if (this.lotHasRegistrations(proofIndex, lotIndex)) {
      this.errorMessage.set('Este lote já tem inscrições e não pode ser removido.');
      return;
    }
    this.lotsOf(proofIndex).removeAt(lotIndex);
  }

  proofName(index: number): string {
    const name = String(this.proofs.at(index).get('name')?.value ?? '').trim();
    return name || `Prova ${index + 1}`;
  }

  otherProofsWithLots(destIndex: number): Array<{ index: number; name: string }> {
    return this.proofs.controls
      .map((_, index) => ({ index, name: this.proofName(index) }))
      .filter((item) => item.index !== destIndex && this.lotsOf(item.index).length > 0);
  }

  toggleCopyPicker(proofIndex: number): void {
    this.copyPickerIndex.update((current) => (current === proofIndex ? null : proofIndex));
  }

  lotHasRegistrations(proofIndex: number, lotIndex: number): boolean {
    const id = String(this.lotsOf(proofIndex).at(lotIndex).get('id')?.value ?? '');
    return !!id && this.usedLotIds().has(id);
  }

  proofHasRegisteredLots(proofIndex: number): boolean {
    return this.lotsOf(proofIndex).controls.some((_, lotIndex) =>
      this.lotHasRegistrations(proofIndex, lotIndex)
    );
  }

  copyLotsFrom(sourceIndex: number, destIndex: number): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (this.proofHasRegisteredLots(destIndex)) {
      this.errorMessage.set(
        'Não é possível substituir os lotes desta prova: já existem inscrições.'
      );
      this.copyPickerIndex.set(null);
      return;
    }

    this.replaceLots(destIndex, this.snapshotLots(sourceIndex));
    this.copyPickerIndex.set(null);
    this.successMessage.set(
      `Lotes copiados de "${this.proofName(sourceIndex)}". Ajuste os preços se precisar.`
    );
  }

  applyLotsToAll(sourceIndex: number): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const snapshot = this.snapshotLots(sourceIndex);
    if (snapshot.length === 0) {
      this.errorMessage.set('Esta prova ainda não tem lotes para copiar.');
      return;
    }

    let applied = 0;
    let skipped = 0;
    for (let dest = 0; dest < this.proofs.length; dest++) {
      if (dest === sourceIndex) {
        continue;
      }
      if (this.proofHasRegisteredLots(dest)) {
        skipped += 1;
        continue;
      }
      this.replaceLots(dest, snapshot);
      applied += 1;
    }

    if (applied === 0 && skipped > 0) {
      this.errorMessage.set(
        'Nenhuma prova foi alterada: as outras já têm lote com inscrições.'
      );
      return;
    }

    const skipNote =
      skipped > 0
        ? ` ${skipped} prova(s) não alterada(s) porque já têm inscrições.`
        : '';
    this.successMessage.set(
      `Lotes aplicados em ${applied} prova(s). Ajuste os preços se precisar.${skipNote}`
    );
  }

  private snapshotLots(proofIndex: number) {
    return this.lotsOf(proofIndex).getRawValue().map((lot) => ({
      name: lot.name,
      price: lot.price,
      startsAtLocal: lot.startsAtLocal,
      endsAtLocal: lot.endsAtLocal,
      capacity: lot.capacity,
    }));
  }

  private replaceLots(
    destIndex: number,
    lots: Array<{
      name?: string;
      price?: number;
      startsAtLocal?: string;
      endsAtLocal?: string;
      capacity?: number | null;
    }>
  ): void {
    const dest = this.lotsOf(destIndex);
    dest.clear();
    for (const lot of lots) {
      dest.push(this.createLotGroup(lot));
    }
  }

  selectAllCategories(index: number): void {
    const group = this.proofs.at(index);
    const ids = this.eventCategories().map((c) => c.id);
    group.get('categoryIds')?.setValue(ids);
  }

  clearCategories(index: number): void {
    this.proofs.at(index).get('categoryIds')?.setValue([]);
  }

  isCategorySelected(proofIndex: number, categoryId: string): boolean {
    const ids = this.proofs.at(proofIndex).get('categoryIds')?.value as string[];
    return Array.isArray(ids) && ids.includes(categoryId);
  }

  toggleCategory(proofIndex: number, categoryId: string, checked: boolean): void {
    const control = this.proofs.at(proofIndex).get('categoryIds') as FormControl<string[]>;
    const current = [...(control.value ?? [])];
    if (checked && !current.includes(categoryId)) {
      control.setValue([...current, categoryId]);
    } else if (!checked) {
      control.setValue(current.filter((id) => id !== categoryId));
    }
  }

  routeImageDisplay(index: number): string | null {
    return (
      this.routeImagePreviews()[index] ||
      (this.proofs.at(index).get('routeImageUrl')?.value as string) ||
      null
    );
  }

  onRouteImageSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const validationError = this.imageUpload.validate('route', file);
    if (validationError) {
      this.errorMessage.set(validationError);
      input.value = '';
      return;
    }

    this.errorMessage.set(null);
    this.clearPreview(index);
    const url = URL.createObjectURL(file);
    this.routeImageFiles[index] = file;
    this.routeImagePreviews.update((m) => ({ ...m, [index]: url }));
    this.routeImageFileNames.update((m) => ({ ...m, [index]: file.name }));
    input.value = '';
  }

  clearRouteImage(index: number): void {
    this.clearPreview(index);
    this.proofs.at(index).get('routeImageUrl')?.setValue('');
  }

  async save(): Promise<void> {
    if (!(await this.persist())) {
      return;
    }
    void this.router.navigateByUrl(this.dashboardPath());
  }

  private async persist(): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.canEdit()) {
      this.errorMessage.set(
        this.isCancelled()
          ? 'Evento cancelado não pode ser editado.'
          : 'Evento encerrado: provas não podem ser alteradas.'
      );
      return false;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return false;
    }

    this.saving.set(true);
    try {
      // Sobe as imagens de percurso escolhidas (por prova) antes de montar o request.
      for (const [key, file] of Object.entries(this.routeImageFiles)) {
        const index = Number(key);
        const url = await this.imageUpload.upload(this.eventId, 'route', file);
        this.proofs.at(index)?.get('routeImageUrl')?.setValue(url);
      }
      this.routeImageFiles = {};

      const updated = await firstValueFrom(
        this.eventsApi.update(this.eventId, this.buildRequest())
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível salvar as provas.'));

      this.event.set(updated);
      return true;
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    void this.router.navigateByUrl(this.dashboardPath());
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
    this.revokeAllPreviews();
    this.routeImageFileNames.set({});

    this.proofs.clear();
    for (const proof of detail.proofs ?? []) {
      this.proofs.push(
        this.createProofGroup({
          id: proof.id,
          name: proof.name,
          routeImageUrl: proof.routeImageUrl ?? '',
          capacity: proof.capacity ?? null,
          startsAtLocal: this.toLocalInput(proof.startsAt),
          categoryIds: [...(proof.categoryIds ?? [])],
          lots: (proof.lots ?? []).map((lot) => ({
            id: lot.id ?? undefined,
            name: lot.name,
            price: lot.price,
            startsAtLocal: this.toLocalInput(lot.startsAt),
            endsAtLocal: this.toLocalInput(lot.endsAt),
            capacity: lot.capacity ?? null,
          })),
        })
      );
    }

    if (!this.canEdit()) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private createProofGroup(initial?: {
    id?: string;
    name?: string;
    routeImageUrl?: string;
    capacity?: number | null;
    startsAtLocal?: string;
    categoryIds?: string[];
    lots?: Array<{
      id?: string;
      name?: string;
      price?: number;
      startsAtLocal?: string;
      endsAtLocal?: string;
      capacity?: number | null;
    }>;
  }) {
    const lots = this.fb.array(
      (initial?.lots ?? []).map((lot) => this.createLotGroup(lot)) as ReturnType<
        EventProofsComponent['createLotGroup']
      >[]
    );

    return this.fb.nonNullable.group({
      id: [initial?.id ?? ''],
      name: [initial?.name ?? '', Validators.required],
      routeImageUrl: [initial?.routeImageUrl ?? ''],
      capacity: [initial?.capacity as number | null],
      startsAtLocal: [initial?.startsAtLocal ?? ''],
      categoryIds: [initial?.categoryIds ?? ([] as string[])],
      lots,
    });
  }

  private createLotGroup(initial?: {
    id?: string;
    name?: string;
    price?: number;
    startsAtLocal?: string;
    endsAtLocal?: string;
    capacity?: number | null;
  }) {
    return this.fb.nonNullable.group({
      id: [initial?.id ?? ''],
      name: [initial?.name ?? '', Validators.required],
      price: [initial?.price ?? 0, [Validators.required, Validators.min(0)]],
      startsAtLocal: [initial?.startsAtLocal ?? '', Validators.required],
      endsAtLocal: [initial?.endsAtLocal ?? '', Validators.required],
      capacity: [initial?.capacity as number | null],
    });
  }

  private buildRequest(): UpdateEventRequest {
    const value = this.form.getRawValue();
    return {
      proofs: value.proofs.map((p) => ({
        id: p.id || null,
        name: p.name.trim(),
        routeImageUrl: p.routeImageUrl.trim() || null,
        capacity:
          p.capacity == null || p.capacity === ('' as unknown) ? null : Number(p.capacity),
        startsAt: this.toIsoUtc(p.startsAtLocal),
        categoryIds: p.categoryIds ?? [],
        lots: (p.lots ?? []).map((l) => ({
          id: l.id || null,
          name: l.name.trim(),
          price: Number(l.price) || 0,
          startsAt: this.toIsoUtc(l.startsAtLocal)!,
          endsAt: this.toIsoUtc(l.endsAtLocal)!,
          capacity:
            l.capacity == null || l.capacity === ('' as unknown) ? null : Number(l.capacity),
        })),
      })),
    };
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

  private clearPreview(index: number): void {
    const current = this.routeImagePreviews()[index];
    if (current) {
      URL.revokeObjectURL(current);
    }
    delete this.routeImageFiles[index];
    this.routeImagePreviews.update((m) => {
      const next = { ...m };
      delete next[index];
      return next;
    });
    this.routeImageFileNames.update((m) => {
      const next = { ...m };
      delete next[index];
      return next;
    });
  }

  private reindexPreviewsAfterRemove(removedIndex: number): void {
    const previews = this.routeImagePreviews();
    const names = this.routeImageFileNames();
    const nextPreviews: Record<number, string> = {};
    const nextNames: Record<number, string> = {};
    const nextFiles: Record<number, File> = {};
    for (const [key, value] of Object.entries(previews)) {
      const i = Number(key);
      if (i < removedIndex) {
        nextPreviews[i] = value;
      } else if (i > removedIndex) {
        nextPreviews[i - 1] = value;
      }
    }
    for (const [key, value] of Object.entries(names)) {
      const i = Number(key);
      if (i < removedIndex) {
        nextNames[i] = value;
      } else if (i > removedIndex) {
        nextNames[i - 1] = value;
      }
    }
    for (const [key, value] of Object.entries(this.routeImageFiles)) {
      const i = Number(key);
      if (i < removedIndex) {
        nextFiles[i] = value;
      } else if (i > removedIndex) {
        nextFiles[i - 1] = value;
      }
    }
    this.routeImagePreviews.set(nextPreviews);
    this.routeImageFileNames.set(nextNames);
    this.routeImageFiles = nextFiles;
  }

  private revokeAllPreviews(): void {
    for (const url of Object.values(this.routeImagePreviews())) {
      URL.revokeObjectURL(url);
    }
    this.routeImagePreviews.set({});
  }
}
