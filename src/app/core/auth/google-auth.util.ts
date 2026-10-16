import { environment } from '../../../environments/environment';

import { normalizeApiBaseUrl } from './api-base.util';

/**
 * Monta URL de início do OAuth Google (redirect full-page, não HttpClient).
 * Contrato: `returnUrl` na API = URL absoluta do callback Angular, com `returnUrl` interno (path).
 * @see contexto/integracao-login-google.md
 */
export function buildGoogleLoginUrl(returnUrl: string): string {
  const base = normalizeApiBaseUrl(environment.apiUrl);
  const callbackUrl = `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`;
  return `${base}${environment.googleAuthPath}?returnUrl=${encodeURIComponent(callbackUrl)}`;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    'Login com Google cancelado ou não autorizado. Verifique se seu e-mail está na lista de testes do Google Cloud.',
  missing_token: 'Não foi possível concluir o login com Google. Tente novamente.',
  session_failed:
    'Login concluído, mas não foi possível carregar sua sessão. Tente entrar novamente.',
};

export function getGoogleOAuthErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) {
    return null;
  }
  return OAUTH_ERROR_MESSAGES[errorCode] ?? 'Falha no login com Google. Tente novamente.';
}
