export type AccountType = 'Athlete' | 'Organizer';
export type DocumentType = 'Cpf' | 'Cnpj' | 'Foreign';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string | null;
  accountType?: AccountType | null;
  documentType?: DocumentType | null;
  document?: string | null;
  nationality?: string | null;
  /** Data de nascimento no formato ISO yyyy-MM-dd. */
  birthDate?: string | null;
  phone?: string | null;
  gender?: string | null;
  companyName?: string | null;
  responsibleDocument?: string | null;
  /** Indica se o perfil tem todos os dados para inscrição/criação de evento. */
  profileComplete?: boolean;
}
