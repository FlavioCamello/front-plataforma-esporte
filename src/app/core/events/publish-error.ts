import { HttpErrorResponse } from '@angular/common/http';

import { getAuthErrorMessage, mapAuthHttpError } from '../auth/auth-http.util';

export class PublishValidationError extends Error {
  constructor(
    message: string,
    readonly errors: string[]
  ) {
    super(message);
    this.name = 'PublishValidationError';
  }
}

/**
 * Trata erros do `POST /events/{id}/publish`. Quando o backend responde `400`
 * com `errors[]`, lança `PublishValidationError` para o componente exibir a lista.
 */
export function mapPublishHttpError(error: unknown): never {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const problem = error.error as { detail?: string; errors?: unknown } | undefined;
    const errors = Array.isArray(problem?.errors)
      ? (problem!.errors as unknown[]).map((e) => String(e)).filter((e) => e.length > 0)
      : [];

    if (errors.length > 0) {
      throw new PublishValidationError(
        problem?.detail?.trim() || 'Evento não pode ser publicado. Corrija os itens indicados.',
        errors
      );
    }
  }

  mapAuthHttpError(error, 'Não foi possível publicar o evento.');
}

export function getPublishErrorMessage(error: unknown): string {
  if (error instanceof PublishValidationError) {
    return error.message;
  }
  return getAuthErrorMessage(error);
}
