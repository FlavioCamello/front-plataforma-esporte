import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { normalizeApiBaseUrl } from '../auth/api-base.util';

export type UploadPurpose = 'banner' | 'route' | 'proof' | 'regulation';

interface PurposeRule {
  types: string[];
  maxBytes: number;
  label: string;
}

const IMAGE_RULE: PurposeRule = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 5 * 1024 * 1024,
  label: 'Formato não suportado. Use JPEG, PNG ou WEBP.',
};

const UPLOAD_RULES: Record<UploadPurpose, PurposeRule> = {
  banner: IMAGE_RULE,
  route: IMAGE_RULE,
  proof: IMAGE_RULE,
  regulation: {
    types: ['application/pdf'],
    maxBytes: 10 * 1024 * 1024,
    label: 'Envie o regulamento em PDF.',
  },
};

/** Resposta do endpoint que gera a URL pré-assinada (UC-28). */
export interface ImageUploadTicket {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAtUtc: string;
  method: string;
  contentType: string;
}

/**
 * Upload de imagens para o S3 via URL pré-assinada.
 * Fluxo: pede a URL à API (com JWT) → faz PUT direto no S3 → devolve a publicUrl.
 *
 * O PUT usa `fetch` (não HttpClient) de propósito: o interceptor de auth injeta
 * `Authorization` em toda request HttpClient, e esse header quebra o PUT assinado do S3.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = normalizeApiBaseUrl(environment.apiUrl);

  /** Valida tipo e tamanho no cliente conforme a finalidade. Retorna erro ou null. */
  validate(purpose: UploadPurpose, file: File): string | null {
    const rule = UPLOAD_RULES[purpose];
    if (!rule.types.includes(file.type)) {
      return rule.label;
    }
    if (file.size > rule.maxBytes) {
      const mb = Math.round(rule.maxBytes / (1024 * 1024));
      return `Arquivo muito grande. O tamanho máximo é ${mb} MB.`;
    }
    return null;
  }

  /** Sobe o arquivo e retorna a URL pública estável (para salvar no evento). */
  async upload(eventId: string, purpose: UploadPurpose, file: File): Promise<string> {
    const validationError = this.validate(purpose, file);
    if (validationError) {
      throw new Error(validationError);
    }

    const ticket = await firstValueFrom(
      this.http.post<ImageUploadTicket>(
        `${this.baseUrl}${environment.eventsPath}/${eventId}/images/upload-url`,
        { purpose, contentType: file.type }
      )
    );

    const response = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': ticket.contentType },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Não foi possível enviar a imagem (S3 respondeu ${response.status}).`);
    }

    return ticket.publicUrl;
  }
}
