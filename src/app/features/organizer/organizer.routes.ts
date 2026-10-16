import { Routes } from '@angular/router';

import { authGuard } from '../../core/guards/auth.guard';
import { organizerGuard } from '../../core/guards/organizer.guard';
import { OrganizerShellComponent } from '../../layout/organizer-shell/organizer-shell.component';
import { ContinueEventComponent } from './events/continue-event/continue-event.component';
import { CreateEventComponent } from './events/create-event/create-event.component';
import { EventProofsComponent } from './events/event-proofs/event-proofs.component';
import { MyEventsComponent } from './events/my-events/my-events.component';
import { OrganizerDashboardComponent } from './dashboard/organizer-dashboard.component';

export const ORGANIZER_ROUTES: Routes = [
  {
    path: '',
    component: OrganizerShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: OrganizerDashboardComponent,
      },
      {
        path: 'inscricoes',
        loadComponent: () =>
          import('../athlete/my-registrations/my-registrations.component').then(
            (m) => m.MyRegistrationsComponent
          ),
      },
      {
        path: 'eventos',
        pathMatch: 'full',
        canActivate: [organizerGuard],
        component: MyEventsComponent,
      },
      {
        path: 'eventos/novo',
        canActivate: [organizerGuard],
        component: CreateEventComponent,
      },
      {
        path: 'eventos/:id/inscritos',
        canActivate: [organizerGuard],
        loadComponent: () =>
          import('./events/event-registrations/event-registrations.component').then(
            (m) => m.EventRegistrationsComponent
          ),
      },
      {
        path: 'eventos/:id/continuar',
        canActivate: [organizerGuard],
        component: ContinueEventComponent,
      },
      {
        path: 'eventos/:id/provas',
        canActivate: [organizerGuard],
        component: EventProofsComponent,
      },
    ],
  },
];
