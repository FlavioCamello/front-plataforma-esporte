import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { OrganizerShellComponent } from './layout/organizer-shell/organizer-shell.component';
import { AuthCallbackComponent } from './features/auth/auth-callback/auth-callback.component';
import { CompleteProfileComponent } from './features/auth/complete-profile/complete-profile.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register-organizer/register-organizer.component';

export const routes: Routes = [
  {
    path: '',
    component: OrganizerShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'e',
      },
      {
        path: 'e',
        loadChildren: () =>
          import('./features/public/public.routes').then((m) => m.PUBLIC_EVENT_ROUTES),
      },
      {
        path: 'previa/:token',
        loadComponent: () =>
          import('./features/public/event-page/event-page.component').then((m) => m.EventPageComponent),
        data: { mode: 'shared-preview' },
      },
      {
        path: 'auth/login',
        component: LoginComponent,
        canActivate: [guestGuard],
      },
      {
        path: 'auth/cadastro',
        component: RegisterComponent,
        canActivate: [guestGuard],
      },
      {
        path: 'auth/cadastro-organizador',
        redirectTo: 'auth/cadastro',
        pathMatch: 'full',
      },
      {
        path: 'auth/completar-perfil',
        component: CompleteProfileComponent,
        canActivate: [authGuard],
      },
      {
        path: 'home',
        loadChildren: () =>
          import('./features/organizer/organizer.routes').then((m) => m.ORGANIZER_ROUTES),
      },
      {
        path: 'organizador',
        redirectTo: 'e',
        pathMatch: 'prefix',
      },
    ],
  },
  {
    path: 'auth/callback',
    component: AuthCallbackComponent,
  },
  {
    path: '**',
    redirectTo: 'e',
  },
];
