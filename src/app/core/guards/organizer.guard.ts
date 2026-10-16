import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { PUBLIC_EVENTS_ROUTE } from '../routing/app-routes';

/** Só organizador acessa rotas de gestão de eventos. */
export const organizerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();

  if (user?.accountType === 'Organizer') {
    return true;
  }

  return router.createUrlTree([PUBLIC_EVENTS_ROUTE]);
};
