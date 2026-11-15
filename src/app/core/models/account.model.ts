/** PATCH /api/me/account — e-mail e documento não entram (não são editáveis). */
export interface UpdateAccountRequest {
  name: string;
  nationality: string | null;
  phone: string;
  gender: string;
  /** yyyy-MM-dd */
  birthDate: string;
  companyName: string | null;
  responsibleDocument: string | null;
}

/** POST /api/me/password */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
