export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError';

  constructor(message = 'E-mail ou senha inválidos.') {
    super(message);
  }
}
