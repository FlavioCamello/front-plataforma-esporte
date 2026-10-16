export interface LoginRequest {
  /** E-mail, CPF ou CNPJ. */
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}
