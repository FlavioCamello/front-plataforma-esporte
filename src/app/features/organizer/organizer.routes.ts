import { Routes } from '@angular/router';

import { authGuard } from '../../core/guards/auth.guard';
import { organizerGuard } from '../../core/guards/organizer.guard';
import { CreateEventComponent } from './events/create-event/create-event.component';
import { EventDashboardComponent } from './events/event-dashboard/event-dashboard.component';
import { EventProofsComponent } from './events/event-proofs/event-proofs.component';
import { EventQuestionnaireComponent } from './events/event-questionnaire/event-questionnaire.component';
import { EventReviewComponent } from './events/event-review/event-review.component';
import { EventSectionComponent, EventSectionKey } from './events/event-section/event-section.component';
import { MyEventsComponent } from './events/my-events/my-events.component';

/** Seções do painel do evento (UC-37) editadas pelo mesmo componente. */
const EVENT_SECTION_ROUTES: Array<{ path: string; section: EventSectionKey }> = [
  { path: 'geral', section: 'general' },
  { path: 'conteudo', section: 'content' },
  { path: 'categorias', section: 'categories' },
  { path: 'kit', section: 'kit' },
  { path: 'configuracoes', section: 'settings' },
];

export const ORGANIZER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: '/e',
      },
      {
        path: 'eventos/:id/previa',
        canActivate: [organizerGuard],
        loadComponent: () =>
          import('../public/event-page/event-page.component').then((m) => m.EventPageComponent),
        data: { mode: 'owner-preview' },
      },
      {
        path: 'meus-dados',
        loadComponent: () =>
          import('../account/my-account/my-account.component').then((m) => m.MyAccountComponent),
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
        path: 'eventos/:id',
        pathMatch: 'full',
        canActivate: [organizerGuard],
        component: EventDashboardComponent,
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
        path: 'eventos/:id/financeiro',
        canActivate: [organizerGuard],
        loadComponent: () =>
          import('./events/event-finance/event-finance.component').then(
            (m) => m.EventFinanceComponent
          ),
      },
      {
        path: 'eventos/:id/continuar',
        redirectTo: 'eventos/:id',
      },
      ...EVENT_SECTION_ROUTES.map(({ path, section }) => ({
        path: `eventos/:id/${path}`,
        canActivate: [organizerGuard],
        component: EventSectionComponent,
        data: { section },
      })),
      {
        path: 'eventos/:id/provas',
        canActivate: [organizerGuard],
        component: EventProofsComponent,
      },
      {
        path: 'eventos/:id/questionario',
        canActivate: [organizerGuard],
        component: EventQuestionnaireComponent,
      },
      {
        path: 'eventos/:id/revisao',
        canActivate: [organizerGuard],
        component: EventReviewComponent,
      },
    ],
  },
];
