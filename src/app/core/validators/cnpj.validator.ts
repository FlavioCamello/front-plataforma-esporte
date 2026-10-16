import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Valida CNPJ (14 dígitos + dígitos verificadores). Aceita com ou sem máscara. */
export function cnpjValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) {
      return null;
    }
    return isValidCnpj(value) ? null : { cnpj: true };
  };
}

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidCnpj(value: string): boolean {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.length !== 14) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const numbers = digits.split('').map((c) => Number(c));

  const checkDigit = (weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += numbers[i] * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(FIRST_WEIGHTS) === numbers[12] && checkDigit(SECOND_WEIGHTS) === numbers[13];
}
