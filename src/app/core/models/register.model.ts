import { DocumentType } from './auth-user.model';

/**
 * Cadastro unificado. O tipo de conta é derivado do documento:
 * CPF / documento estrangeiro → atleta; CNPJ → organizador.
 */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  documentType: DocumentType;
  document: string;
  /** Pessoa física; "Brasil" por padrão. */
  nationality?: string | null;
  phone: string;
  gender: string;
  /** Data de nascimento no formato ISO yyyy-MM-dd. */
  birthDate: string;
  /** Apenas PJ (organizador). */
  companyName?: string | null;
  /** Apenas PJ (organizador) — CPF do responsável. */
  responsibleDocument?: string | null;
}
