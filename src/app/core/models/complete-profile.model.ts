import { DocumentType } from './auth-user.model';

/**
 * Complementa o perfil do usuário autenticado (ex.: após login Google, ao se inscrever
 * em evento ou ao criar evento). Define o tipo de conta com base no documento.
 */
export interface CompleteProfileRequest {
  documentType: DocumentType;
  document: string;
  nationality?: string | null;
  phone: string;
  gender: string;
  /** Data de nascimento no formato ISO yyyy-MM-dd. */
  birthDate: string;
  companyName?: string | null;
  responsibleDocument?: string | null;
}
