import { AuthUser } from '../models/auth-user.model';

/** Rota da área autenticada (home logada — atleta ou organizador). */
export const USER_HOME_ROUTE = '/home';

/** Vitrine pública de eventos. */
export const PUBLIC_EVENTS_ROUTE = '/e';

/** Destino padrão pós-login conforme o tipo de conta. */
export function defaultHomeFor(user: AuthUser | null | undefined): string {
  return user?.accountType === 'Organizer' ? USER_HOME_ROUTE : PUBLIC_EVENTS_ROUTE;
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
  return path === USER_HOME_ROUTE;
}
