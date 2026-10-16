import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { defaultHomeFor } from '../routing/app-routes';

/** Evita que usuário logado acesse telas de login/cadastro novamente. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([defaultHomeFor(auth.currentUser())]);
};
