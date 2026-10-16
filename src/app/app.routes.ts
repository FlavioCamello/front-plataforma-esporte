import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { USER_HOME_ROUTE } from './core/routing/app-routes';
import { AuthCallbackComponent } from './features/auth/auth-callback/auth-callback.component';
import { CompleteProfileComponent } from './features/auth/complete-profile/complete-profile.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register-organizer/register-organizer.component';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent,
  },
  {
    path: 'e',
    loadChildren: () =>
      import('./features/public/public.routes').then((m) => m.PUBLIC_EVENT_ROUTES),
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
    path: 'auth/callback',
    component: AuthCallbackComponent,
  },
  {
    path: 'auth/completar-perfil',
    component: CompleteProfileComponent,
    canActivate: [authGuard],
  },
  {
    path: USER_HOME_ROUTE.slice(1),
    loadChildren: () =>
      import('./features/organizer/organizer.routes').then((m) => m.ORGANIZER_ROUTES),
  },
  {
    path: 'organizador',
    redirectTo: USER_HOME_ROUTE.slice(1),
    pathMatch: 'prefix',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
