import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Valida CPF (11 dígitos + dígitos verificadores). Aceita com ou sem máscara. */
export function cpfValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) {
      return null;
    }
    return isValidCpf(value) ? null : { cpf: true };
  };
}

export function isValidCpf(value: string): boolean {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const numbers = digits.split('').map((c) => Number(c));

  const checkDigit = (length: number, startWeight: number): number => {
    let sum = 0;
    let weight = startWeight;
    for (let i = 0; i < length; i++) {
      sum += numbers[i] * weight--;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(9, 10) === numbers[9] && checkDigit(10, 11) === numbers[10];
}
