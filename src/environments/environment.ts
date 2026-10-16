export const environment = {
  production: true,
  apiUrl: 'https://api.plataforma-esporte.com',
  /** URL pública do front (usada em canonical/OG no SSR, onde não há window). */
  siteUrl: 'https://plataforma-esporte.com',
  googleAuthPath: '/api/auth/google',
  googleAuthStatusPath: '/api/auth/google/status',
  credentialsLoginPath: '/api/auth/login',
  registerPath: '/api/auth/register',
  completeProfilePath: '/api/me/profile',
  meRegistrationsPath: '/api/me/registrations',
  eventsPath: '/api/events',
  /** Quando false, login e-mail/senha usa a API .NET. */
  useAuthMock: false,
  useAuthMockGoogle: false,
};
