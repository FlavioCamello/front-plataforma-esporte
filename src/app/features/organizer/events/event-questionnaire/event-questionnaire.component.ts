import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
  CustomFormQuestion,
  CustomFormQuestionType,
  EventDetail,
  EventModules,
} from '../../../../core/models/event.model';
import { USER_HOME_ROUTE } from '../../../../core/routing/app-routes';

const TYPE_OPTIONS: Array<{ value: CustomFormQuestionType; label: string }> = [
  { value: 'Text', label: 'Texto' },
  { value: 'SingleChoice', label: 'Opção única' },
  { value: 'MultipleChoice', label: 'Múltipla escolha' },
  { value: 'Dropdown', label: 'Lista (dropdown)' },
];

@Component({
  selector: 'app-event-questionnaire',
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
  ],
  templateUrl: './event-questionnaire.component.html',
  styleUrl: './event-questionnaire.component.scss',
})
export class EventQuestionnaireComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApiService);
  private readonly fb = inject(FormBuilder);

  readonly homeRoute = USER_HOME_ROUTE;
  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly typeOptions = TYPE_OPTIONS;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly event = signal<EventDetail | null>(null);

  readonly isCancelled = computed(() => this.event()?.status === 'Cancelled');
  readonly isClosed = computed(() => this.event()?.status === 'Closed');
  readonly canEdit = computed(() => !this.isClosed() && !this.isCancelled());
  readonly proofs = computed(() => this.event()?.proofs ?? []);

  readonly form = this.fb.nonNullable.group({
    enabled: [false],
    questions: this.fb.array([] as ReturnType<EventQuestionnaireComponent['createQuestionGroup']>[]),
  });

  get questions(): FormArray {
    return this.form.controls.questions;
  }

  ngOnInit(): void {
    void this.load();
  }

  dashboardPath(): string {
    return `${this.homeRoute}/eventos/${this.eventId}`;
  }

  isChoice(index: number): boolean {
    const type = this.questions.at(index).get('type')?.value as CustomFormQuestionType;
    return type !== 'Text';
  }

  addQuestion(preset?: CustomFormQuestion): void {
    this.questions.push(this.createQuestionGroup(preset));
    if (!this.form.controls.enabled.value) {
      this.form.controls.enabled.setValue(true);
    }
  }

  addPreset(kind: 'bib' | 'team' | 'emergency'): void {
    const presets: Record<typeof kind, CustomFormQuestion> = {
      bib: {
        title: 'Nome no número de peito',
        type: 'Text',
        required: false,
        maxLength: 12,
        options: [],
        proofIds: [],
      },
      team: {
        title: 'Equipe / assessoria',
        type: 'Text',
        required: false,
        maxLength: 80,
        options: [],
        proofIds: [],
      },
      emergency: {
        title: 'Contato de emergência',
        type: 'Text',
        required: true,
        maxLength: 80,
        options: [],
        proofIds: [],
      },
    };
    this.addQuestion(presets[kind]);
  }

  removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  toggleProof(index: number, proofId: string, checked: boolean): void {
    const control = this.questions.at(index).get('proofIds');
    const allIds = this.proofs()
      .map((p) => p.id)
      .filter((id): id is string => !!id);
    const raw = [...((control?.value as string[]) ?? [])];
    const current = raw.length === 0 ? [...allIds] : raw;
    const next = checked
      ? [...new Set([...current, proofId])]
      : current.filter((id) => id !== proofId);
    control?.setValue(next.length === allIds.length ? [] : next);
  }

  hasProof(index: number, proofId: string): boolean {
    const ids = (this.questions.at(index).get('proofIds')?.value as string[]) ?? [];
    return ids.length === 0 || ids.includes(proofId);
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) {
      return;
    }

    this.form.markAllAsTouched();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.saving.set(true);

    try {
      const current = this.event();
      if (!current) {
        return;
      }

      const updated = await firstValueFrom(
        this.eventsApi.update(this.eventId, {
          modules: this.buildModules(current.modules),
        })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível salvar o questionário.'));

      this.event.set(updated);
      this.patchForm(updated);
      this.successMessage.set('Questionário salvo.');
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
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
    const form = detail.modules.customForm ?? { enabled: false, questions: [] };
    this.form.controls.enabled.setValue(form.enabled);
    this.questions.clear();
    for (const question of form.questions ?? []) {
      this.questions.push(this.createQuestionGroup(question));
    }

    if (!this.canEdit()) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private createQuestionGroup(initial?: Partial<CustomFormQuestion>) {
    return this.fb.nonNullable.group({
      id: [initial?.id ?? ''],
      title: [initial?.title ?? '', [Validators.required, Validators.maxLength(200)]],
      type: [(initial?.type ?? 'Text') as CustomFormQuestionType, Validators.required],
      required: [initial?.required ?? false],
      maxLength: [initial?.maxLength ?? 200, [Validators.min(1), Validators.max(500)]],
      optionsText: [(initial?.options ?? []).join('\n')],
      proofIds: [initial?.proofIds ?? []],
    });
  }

  private buildModules(current: EventModules): EventModules {
    const value = this.form.getRawValue();
    const questions: CustomFormQuestion[] = value.questions.map((q) => {
      const type = q.type as CustomFormQuestionType;
      const options =
        type === 'Text'
          ? []
          : q.optionsText
              .split('\n')
              .map((o) => o.trim())
              .filter((o) => o.length > 0);
      const allProofIds = this.proofs().map((p) => p.id!).filter(Boolean);
      const selected = (q.proofIds as string[]) ?? [];
      const proofIds =
        selected.length === 0 || selected.length === allProofIds.length ? [] : selected;

      return {
        id: q.id || null,
        title: q.title.trim(),
        type,
        required: q.required,
        maxLength: type === 'Text' ? Number(q.maxLength) || 200 : null,
        options,
        proofIds,
      };
    });

    return {
      ...current,
      customForm: {
        enabled: value.enabled && questions.length > 0,
        questions,
      },
    };
  }
}
