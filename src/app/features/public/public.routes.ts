import { Routes } from '@angular/router';

import { authGuard } from '../../core/guards/auth.guard';

export const PUBLIC_EVENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./events-browse/events-browse.component').then((m) => m.EventsBrowseComponent),
  },
  {
    path: ':slug/inscricao/retorno',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./event-registration-return/event-registration-return.component').then(
        (m) => m.EventRegistrationReturnComponent
      ),
  },
  {
    path: ':slug/inscricao',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./event-registration/event-registration.component').then(
        (m) => m.EventRegistrationComponent
      ),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./event-page/event-page.component').then((m) => m.EventPageComponent),
  },
];
