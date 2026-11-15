import { Component, Injector, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { getAuthErrorMessage } from '../../../core/auth/auth-http.util';
import { AuthService } from '../../../core/auth/auth.service';
import { GENDER_OPTIONS, NATIONALITY_OPTIONS } from '../../../core/auth/profile-options';
import { AuthUser } from '../../../core/models/auth-user.model';
import { USER_HOME_ROUTE } from '../../../core/routing/app-routes';
import { cpfValidator } from '../../../core/validators/cpf.validator';

const PASSWORD_MIN_LENGTH = 8;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.scss',
})
export class MyAccountComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

  readonly user = this.auth.currentUser;
  readonly completeProfileLink = '/auth/completar-perfil';
  readonly completeProfileQuery = { returnUrl: `${USER_HOME_ROUTE}/meus-dados` };

  readonly genders = GENDER_OPTIONS;
  readonly maxBirthDate = new Date().toISOString().slice(0, 10);
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  readonly hasProfile = computed(() => !!this.user()?.accountType && !!this.user()?.document);
  readonly isOrganizer = computed(() => this.user()?.accountType === 'Organizer');
  readonly isForeign = computed(() => this.user()?.documentType === 'Foreign');
  readonly hasPassword = computed(() => this.user()?.hasPassword === true);

  readonly accountLabel = computed(() =>
    this.isOrganizer() ? 'Organizador (pessoa jurídica)' : 'Atleta (pessoa física)'
  );
  readonly documentLabel = computed(() => {
    switch (this.user()?.documentType) {
      case 'Cnpj':
        return 'CNPJ';
      case 'Foreign':
        return 'Documento estrangeiro';
      default:
        return 'CPF';
    }
  });
  readonly documentDisplay = computed(() => formatDocument(this.user()));

  /** Documento estrangeiro não aceita "Brasil"; valores fora da lista continuam selecionáveis. */
  readonly nationalities = computed(() => {
    const base: string[] = NATIONALITY_OPTIONS.filter(
      (option) => !this.isForeign() || option !== 'Brasil'
    );
    const current = this.user()?.nationality;
    return current && !base.includes(current) ? [current, ...base] : base;
  });

  readonly savingProfile = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly profileSuccess = signal<string | null>(null);

  readonly savingPassword = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSuccess = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nationality: [''],
    birthDate: ['', [Validators.required]],
    gender: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\D*(\d\D*){10,11}$/)]],
    companyName: [''],
    responsibleDocument: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  /** Evita pular o preenchimento quando o /me completa campos que o JWT não traz. */
  private loadedFingerprint: string | null = null;

  constructor() {
    effect(() => {
      const user = this.user();
      if (!user) {
        return;
      }

      const fingerprint = [
        user.id,
        user.name,
        user.nationality,
        user.birthDate,
        user.gender,
        user.phone,
        user.companyName,
        user.responsibleDocument,
      ].join('|');
      if (fingerprint === this.loadedFingerprint) {
        return;
      }
      this.loadedFingerprint = fingerprint;

      // Depois do bind do template: input date / mat-select não engolem o valor.
      afterNextRender(() => this.fillProfileForm(user), { injector: this.injector });
    });
  }

  async saveProfile(): Promise<void> {
    this.profileError.set(null);
    this.profileSuccess.set(null);

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const raw = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    try {
      const updated = await this.auth.updateAccount({
        name: raw.name,
        nationality: this.isOrganizer() ? null : raw.nationality,
        phone: raw.phone,
        gender: raw.gender,
        birthDate: raw.birthDate,
        companyName: this.isOrganizer() ? raw.companyName : null,
        responsibleDocument: this.isOrganizer() ? raw.responsibleDocument : null,
      });
      this.fillProfileForm(updated);
      this.profileSuccess.set('Dados salvos.');
    } catch (error) {
      this.profileError.set(getAuthErrorMessage(error));
    } finally {
      this.savingProfile.set(false);
    }
  }

  async savePassword(): Promise<void> {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    try {
      await this.auth.changePassword(this.passwordForm.getRawValue());
      this.passwordForm.reset();
      this.passwordSuccess.set('Senha alterada. Use a nova senha no próximo login.');
    } catch (error) {
      this.passwordError.set(getAuthErrorMessage(error));
    } finally {
      this.savingPassword.set(false);
    }
  }

  private fillProfileForm(user: AuthUser): void {
    const organizer = user.accountType === 'Organizer';
    const { nationality, companyName, responsibleDocument } = this.profileForm.controls;

    if (organizer) {
      companyName.setValidators([Validators.required, Validators.minLength(2)]);
      responsibleDocument.setValidators([Validators.required, cpfValidator()]);
      nationality.clearValidators();
    } else {
      nationality.setValidators([Validators.required]);
      companyName.clearValidators();
      responsibleDocument.clearValidators();
    }

    this.profileForm.reset({
      name: user.name ?? '',
      nationality: user.nationality ?? (user.documentType === 'Foreign' ? '' : 'Brasil'),
      birthDate: user.birthDate ?? '',
      gender: user.gender ?? '',
      phone: formatPhone(user.phone),
      companyName: user.companyName ?? '',
      responsibleDocument: formatCpf(user.responsibleDocument),
    });
  }
}

function formatPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value ?? '';
}

function formatCpf(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 11
    ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    : value ?? '';
}

function formatDocument(user: AuthUser | null): string {
  const document = user?.document ?? '';
  if (user?.documentType === 'Cpf') {
    return formatCpf(document);
  }
  if (user?.documentType === 'Cnpj') {
    const d = document.replace(/\D/g, '');
    return d.length === 14
      ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
      : document;
  }
  return document;
}
