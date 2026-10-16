export const environment = {
  production: false,
  /** API Docker: http://localhost:5080 | HTTPS local: https://localhost:5001 */
  apiUrl: 'http://localhost:5080',
  /** URL pública do front (usada em canonical/OG no SSR, onde não há window). */
  siteUrl: 'http://localhost:4000',
  googleAuthPath: '/api/auth/google',
  googleAuthStatusPath: '/api/auth/google/status',
  credentialsLoginPath: '/api/auth/login',
  registerPath: '/api/auth/register',
  completeProfilePath: '/api/me/profile',
  meRegistrationsPath: '/api/me/registrations',
  eventsPath: '/api/events',
  /** E-mail/senha chama a API real. */
  useAuthMock: false,
  /** Google OAuth via redirect para a API (ver integracao-login-google.md). */
  useAuthMockGoogle: false,
};
