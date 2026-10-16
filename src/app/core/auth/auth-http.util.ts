import { HttpErrorResponse } from '@angular/common/http';

import { InvalidCredentialsError } from './auth.errors';

interface ProblemDetails {
  title?: string;
  status?: number;
  detail?: string;
}

export function mapAuthHttpError(
  error: unknown,
  defaultMessage = 'Não foi possível concluir a operação. Tente novamente.'
): never {
  if (error instanceof InvalidCredentialsError) {
    throw error;
  }

  if (error instanceof HttpErrorResponse) {
    const problem = error.error as ProblemDetails | undefined;
    const detail = problem?.detail?.trim();

    if (error.status === 0) {
      throw new Error(
        'Não foi possível conectar à API. Verifique se o backend está em execução (ex.: http://localhost:5080).'
      );
    }

    if (error.status === 401) {
      throw new InvalidCredentialsError(detail || 'E-mail ou senha inválidos.');
    }

    if (error.status === 403) {
      throw new Error(detail || 'Acesso negado.');
    }

    if (error.status === 409) {
      throw new Error(detail || 'E-mail já cadastrado.');
    }

    if (error.status === 429) {
      throw new Error(detail || 'Muitas tentativas. Aguarde um minuto e tente novamente.');
    }

    if ((error.status === 400 || error.status === 422) && detail) {
      throw new Error(detail);
    }

    if (detail) {
      throw new Error(detail);
    }
  }

  throw new Error(defaultMessage);
}

/** @deprecated Use mapAuthHttpError */
export function mapLoginHttpError(error: unknown): never {
  return mapAuthHttpError(error, 'Não foi possível entrar. Tente novamente.');
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
