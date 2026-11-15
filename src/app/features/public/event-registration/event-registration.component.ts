import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { getAuthErrorMessage, mapAuthHttpError } from '../../../core/auth/auth-http.util';
import { formatEventDateRange } from '../../../core/events/event-date-range';
import { PublicEventsApiService } from '../../../core/events/public-events-api.service';
import { CustomFormQuestion, PublicEventDetail } from '../../../core/models/event.model';
import { RegistrationsApiService } from '../../../core/registrations/registrations-api.service';
import { PUBLIC_EVENTS_ROUTE, USER_HOME_ROUTE } from '../../../core/routing/app-routes';

@Component({
  selector: 'app-event-registration',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './event-registration.component.html',
  styleUrl: './event-registration.component.scss',
})
export class EventRegistrationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly publicApi = inject(PublicEventsApiService);
  private readonly registrationsApi = inject(RegistrationsApiService);

  readonly publicEventsRoute = PUBLIC_EVENTS_ROUTE;
  readonly myRegistrationsRoute = `${USER_HOME_ROUTE}/inscricoes`;
  readonly routeSlug = this.route.snapshot.paramMap.get('slug') ?? '';

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly event = signal<PublicEventDetail | null>(null);
  readonly selectedProofId = signal('');
  readonly selectedCategoryId = signal('');

  readonly form = this.fb.nonNullable.group({
    proofId: ['', Validators.required],
    categoryId: ['', Validators.required],
    shirtSize: [''],
    regulationAccepted: [false, Validators.requiredTrue],
  });

  readonly shirtRequired = computed(
    () => this.event()?.modules?.shirtSizeChart?.enabled === true
  );

  readonly dateRange = computed(() => {
    const ev = this.event();
    return ev ? formatEventDateRange(ev.startsAt, ev.endsAt) : '';
  });

  readonly eventSoldOut = computed(() => this.event()?.soldOut === true);
  readonly isOrganizer = computed(() => this.auth.currentUser()?.accountType === 'Organizer');

  readonly availableCategories = computed(() => {
    const ev = this.event();
    const proofId = this.selectedProofId();
    if (!ev || !proofId) {
      return [];
    }
    const proof = ev.proofs.find((p) => p.id === proofId);
    if (!proof) {
      return [];
    }
    return ev.categories.filter((c) => proof.categoryIds.includes(c.id!));
  });

  readonly allCategoriesSoldOut = computed(() => {
    const cats = this.availableCategories();
    return cats.length > 0 && cats.every((c) => c.soldOut);
  });

  readonly visibleQuestions = computed<CustomFormQuestion[]>(() => {
    const ev = this.event();
    const proofId = this.selectedProofId();
    const form = ev?.modules?.customForm;
    if (!ev || !proofId || !form?.enabled) {
      return [];
    }
    return (form.questions ?? []).filter(
      (q) => !q.proofIds?.length || q.proofIds.includes(proofId)
    );
  });

  readonly answers = signal<Record<string, string[]>>({});

  readonly shirtSizes = computed(() => this.event()?.modules?.shirtSizeChart?.sizes ?? []);

  /**
   * Preço da inscrição para a categoria escolhida (UC-26). Só disponível após escolher
   * percurso + categoria. Espelha a regra do backend: lote vigente da prova × desconto da
   * categoria. Retorna null quando não há categoria selecionada ou lote vigente.
   */
  readonly priceInfo = computed(() => {
    const ev = this.event();
    const proofId = this.selectedProofId();
    const categoryId = this.selectedCategoryId();
    if (!ev || !proofId || !categoryId) {
      return null;
    }

    const proof = ev.proofs.find((p) => p.id === proofId);
    const category = ev.categories.find((c) => c.id === categoryId);
    if (!proof || !category) {
      return null;
    }

    const lot = this.resolveCurrentLot(proof.lots ?? []);
    if (!lot) {
      return { hasLot: false, basePrice: 0, finalPrice: 0, discountPercent: 0 };
    }

    const discountPercent =
      category.discountPercent && category.discountPercent > 0
        ? Math.min(category.discountPercent, 100)
        : 0;
    const finalPrice = this.applyDiscount(lot.price, discountPercent);

    return {
      hasLot: true,
      basePrice: lot.price,
      finalPrice,
      discountPercent,
    };
  });

  private resolveCurrentLot(
    lots: { price: number; startsAt: string; endsAt: string; soldOut?: boolean }[]
  ) {
    const now = Date.now();
    let previousSoldOut = false;
    for (const lot of lots) {
      const starts = new Date(lot.startsAt).getTime();
      const ends = new Date(lot.endsAt).getTime();
      if (now > ends) {
        continue;
      }
      if (lot.soldOut) {
        previousSoldOut = true;
        continue;
      }
      if (now >= starts || previousSoldOut) {
        return lot;
      }
      return undefined;
    }
    return undefined;
  }

  textValue(questionId: string): string {
    return this.answers()[questionId]?.[0] ?? '';
  }

  setText(questionId: string, value: string): void {
    this.answers.update((current) => ({ ...current, [questionId]: value.trim() ? [value] : [] }));
  }

  setSingle(questionId: string, value: string): void {
    this.answers.update((current) => ({ ...current, [questionId]: value ? [value] : [] }));
  }

  isMultiChecked(questionId: string, option: string): boolean {
    return (this.answers()[questionId] ?? []).includes(option);
  }

  toggleMulti(questionId: string, option: string, checked: boolean): void {
    this.answers.update((current) => {
      const next = new Set(current[questionId] ?? []);
      if (checked) {
        next.add(option);
      } else {
        next.delete(option);
      }
      return { ...current, [questionId]: [...next] };
    });
  }

  private applyDiscount(price: number, discountPercent: number): number {
    if (discountPercent <= 0 || price <= 0) {
      return price;
    }
    const factor = (100 - discountPercent) / 100;
    return Math.round(price * factor * 100) / 100;
  }

  ngOnInit(): void {
    if (!this.auth.profileComplete()) {
      void this.router.navigate(['/auth/completar-perfil'], {
        queryParams: { returnUrl: `/e/${this.routeSlug}/inscricao` },
      });
      return;
    }

    this.form.controls.proofId.valueChanges.subscribe((value) => {
      this.selectedProofId.set(value);
      this.form.controls.categoryId.setValue('');
      this.answers.set({});
    });

    this.form.controls.categoryId.valueChanges.subscribe((value) => {
      this.selectedCategoryId.set(value);
    });

    void this.load();
  }

  async submit(): Promise<void> {
    const ev = this.event();
    if (!ev || this.isOrganizer() || this.form.invalid || this.submitting() || ev.soldOut) {
      this.form.markAllAsTouched();
      if (ev?.soldOut) {
        this.errorMessage.set('Vagas esgotadas para este evento.');
      }
      return;
    }

    const raw = this.form.getRawValue();
    const selectedCategory = ev.categories.find((c) => c.id === raw.categoryId);
    if (selectedCategory?.soldOut) {
      this.errorMessage.set('Vagas esgotadas para esta categoria.');
      return;
    }

    const missing = this.visibleQuestions().find(
      (q) => q.required && (this.answers()[q.id!] ?? []).length === 0
    );
    if (missing) {
      this.errorMessage.set(`'${missing.title}' é obrigatória.`);
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const created = await firstValueFrom(
        this.registrationsApi.create(ev.id, {
          proofId: raw.proofId,
          categoryId: raw.categoryId,
          regulationAccepted: raw.regulationAccepted,
          shirtSize: this.shirtRequired() ? raw.shirtSize : null,
          answers: this.visibleQuestions().map((q) => ({
            questionId: q.id!,
            title: q.title,
            values: this.answers()[q.id!] ?? [],
          })),
        })
      ).catch((err) => mapAuthHttpError(err, 'Não foi possível concluir a inscrição.'));

      if (created.status === 'Pending') {
        await this.router.navigate(['/e', this.routeSlug, 'pagamento', created.id]);
        return;
      }

      this.successMessage.set(
        created.status === 'Confirmed'
          ? 'Inscrição confirmada!'
          : 'Inscrição registrada (aguardando pagamento).'
      );
      setTimeout(() => {
        void this.router.navigateByUrl(this.myRegistrationsRoute);
      }, 900);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const detail = await firstValueFrom(this.publicApi.getBySlug(this.routeSlug)).catch((err) =>
        mapAuthHttpError(err, 'Evento não encontrado.')
      );

      if (!detail.registrationOpen) {
        this.errorMessage.set('Inscrições encerradas para este evento.');
        this.event.set(detail);
        return;
      }

      this.event.set(detail);

      if (this.shirtRequired()) {
        this.form.controls.shirtSize.setValidators([Validators.required]);
      } else {
        this.form.controls.shirtSize.clearValidators();
      }
      this.form.controls.shirtSize.updateValueAndValidity();

      if (detail.proofs.length === 1 && detail.proofs[0].id) {
        this.form.controls.proofId.setValue(detail.proofs[0].id);
        this.selectedProofId.set(detail.proofs[0].id);
      }
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
