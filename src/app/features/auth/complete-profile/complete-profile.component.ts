import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { getAuthErrorMessage } from '../../../core/auth/auth-http.util';
import { AuthService } from '../../../core/auth/auth.service';
import { GENDER_OPTIONS, NATIONALITY_OPTIONS } from '../../../core/auth/profile-options';
import { DocumentType } from '../../../core/models/auth-user.model';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';
import { cnpjValidator } from '../../../core/validators/cnpj.validator';
import { cpfValidator } from '../../../core/validators/cpf.validator';

type PersonType = 'pf' | 'pj';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './complete-profile.component.html',
  styleUrl: './complete-profile.component.scss',
})
export class CompleteProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly genders = GENDER_OPTIONS;
  readonly nationalities = NATIONALITY_OPTIONS;
  readonly maxBirthDate = new Date().toISOString().slice(0, 10);

  readonly userName = this.auth.currentUser()?.name ?? '';

  readonly personType = signal<PersonType>('pf');
  private readonly nationality = signal<string>('Brasil');

  readonly isOrganizer = computed(() => this.personType() === 'pj');
  readonly isForeign = computed(() => this.personType() === 'pf' && this.nationality() !== 'Brasil');

  readonly form = this.fb.nonNullable.group({
    personType: ['pf' as PersonType, [Validators.required]],
    nationality: ['Brasil', [Validators.required]],
    document: ['', [Validators.required, cpfValidator()]],
    companyName: [''],
    responsibleDocument: [''],
    birthDate: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\D*(\d\D*){10,11}$/)]],
    gender: ['', [Validators.required]],
  });

  constructor() {
    this.form.controls.personType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.personType.set(value);
        this.applyConditionalValidators();
      });

    this.form.controls.nationality.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.nationality.set(value);
        this.applyConditionalValidators();
      });
  }

  setPersonType(type: PersonType): void {
    this.form.controls.personType.setValue(type);
  }

  leave(): void {
    void this.router.navigateByUrl(this.returnUrl);
  }

  private get returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? USER_HOME_ROUTE;
  }

  private get documentType(): DocumentType {
    if (this.isOrganizer()) {
      return 'Cnpj';
    }
    return this.isForeign() ? 'Foreign' : 'Cpf';
  }

  private applyConditionalValidators(): void {
    const { document, companyName, responsibleDocument, nationality } = this.form.controls;

    if (this.isOrganizer()) {
      document.setValidators([Validators.required, cnpjValidator()]);
      companyName.setValidators([Validators.required, Validators.minLength(2)]);
      responsibleDocument.setValidators([Validators.required, cpfValidator()]);
      nationality.clearValidators();
    } else {
      companyName.clearValidators();
      responsibleDocument.clearValidators();
      nationality.setValidators([Validators.required]);
      document.setValidators(
        this.isForeign() ? [Validators.required] : [Validators.required, cpfValidator()]
      );
    }

    document.updateValueAndValidity({ emitEvent: false });
    companyName.updateValueAndValidity({ emitEvent: false });
    responsibleDocument.updateValueAndValidity({ emitEvent: false });
    nationality.updateValueAndValidity({ emitEvent: false });
  }

  async submit(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.loading.set(true);

    try {
      await this.auth.completeProfile({
        documentType: this.documentType,
        document: raw.document,
        nationality: this.isOrganizer() ? null : raw.nationality,
        phone: raw.phone,
        gender: raw.gender,
        birthDate: raw.birthDate,
        companyName: this.isOrganizer() ? raw.companyName : null,
        responsibleDocument: this.isOrganizer() ? raw.responsibleDocument : null,
      });

      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
