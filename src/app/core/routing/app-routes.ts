import { AuthUser } from '../models/auth-user.model';

/** Rota da área autenticada (home logada — atleta ou organizador). */
export const USER_HOME_ROUTE = '/home';

/** Vitrine pública de eventos. */
export const PUBLIC_EVENTS_ROUTE = '/e';

/** A tela inicial, logado ou não, é a vitrine de eventos. */
export function defaultHomeFor(_user?: AuthUser | null): string {
  return PUBLIC_EVENTS_ROUTE;
}

/**
 * Indica se o returnUrl é genérico e deve ser trocado pelo default do perfil.
 * Paths explícitos (`/e/:slug`, `/home/inscricoes`, etc.) são preservados.
 */
export function isDefaultReturnUrl(returnUrl: string | null | undefined): boolean {
  if (!returnUrl || returnUrl === '/') {
    return true;
  }
  const path = returnUrl.split('?')[0];
  return path === USER_HOME_ROUTE || path === PUBLIC_EVENTS_ROUTE;
}
