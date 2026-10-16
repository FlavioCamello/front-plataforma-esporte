import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { AuthService } from '../../../core/auth/auth.service';
import { PUBLIC_EVENTS_ROUTE, USER_HOME_ROUTE } from '../../../core/routing/app-routes';

@Component({
  selector: 'app-organizer-dashboard',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule],
  template: `
    @if (!auth.profileComplete()) {
      <mat-card class="profile-cta">
        <mat-card-content>
          <p>
            Seu perfil ainda está incompleto. Complete seus dados para se inscrever em eventos
            ou criar eventos.
          </p>
          <a
            mat-flat-button
            color="primary"
            routerLink="/auth/completar-perfil"
            [queryParams]="{ returnUrl: homeRoute }"
          >
            Completar perfil
          </a>
        </mat-card-content>
      </mat-card>
    }

    <mat-card>
      <mat-card-header>
        <mat-card-title>Bem-vindo, {{ auth.currentUser()?.name }}</mat-card-title>
        <mat-card-subtitle>Sua home na plataforma</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (isOrganizer()) {
          <p>Gerencie seus eventos, continue rascunhos e publique quando estiver pronto.</p>
          <div class="actions">
            <a mat-stroked-button color="primary" [routerLink]="myEventsRoute">Meus eventos</a>
            <a mat-flat-button color="primary" [routerLink]="createEventRoute">Criar evento</a>
          </div>
        } @else {
          <p>Acompanhe suas inscrições e descubra novos desafios na vitrine.</p>
          <div class="actions">
            <a mat-stroked-button color="primary" [routerLink]="myRegistrationsRoute"
              >Meus eventos</a
            >
            <a mat-flat-button color="primary" [routerLink]="publicEventsRoute">Ver eventos</a>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .profile-cta {
      margin-bottom: 1rem;
      border-left: 4px solid var(--brand-orange);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
  `,
})
export class OrganizerDashboardComponent {
  readonly auth = inject(AuthService);
  readonly homeRoute = USER_HOME_ROUTE;
  readonly myEventsRoute = `${USER_HOME_ROUTE}/eventos`;
  readonly myRegistrationsRoute = `${USER_HOME_ROUTE}/inscricoes`;
  readonly createEventRoute = `${USER_HOME_ROUTE}/eventos/novo`;
  readonly publicEventsRoute = PUBLIC_EVENTS_ROUTE;
  readonly isOrganizer = computed(() => this.auth.currentUser()?.accountType === 'Organizer');
}
