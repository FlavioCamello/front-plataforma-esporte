import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { filter, map } from 'rxjs';


import { AuthService } from '../../core/auth/auth.service';
import { PUBLIC_EVENTS_ROUTE, USER_HOME_ROUTE } from '../../core/routing/app-routes';
import { BrandMarkComponent } from '../../shared/brand-mark/brand-mark.component';

@Component({
  selector: 'app-organizer-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    BrandMarkComponent,
  ],
  templateUrl: './organizer-shell.component.html',
  styleUrl: './organizer-shell.component.scss',
})
export class OrganizerShellComponent {
  private readonly router = inject(Router);

  readonly auth = inject(AuthService);
  readonly eventsRoute = PUBLIC_EVENTS_ROUTE;
  readonly loginRoute = '/auth/login';
  readonly myEventsRoute = `${USER_HOME_ROUTE}/eventos`;
  readonly myRegistrationsRoute = `${USER_HOME_ROUTE}/inscricoes`;
  readonly createEventRoute = `${USER_HOME_ROUTE}/eventos/novo`;
  readonly myAccountRoute = `${USER_HOME_ROUTE}/meus-dados`;

  readonly isOrganizer = computed(() => this.auth.currentUser()?.accountType === 'Organizer');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  /** Vitrine e página do evento ocupam a área útil, sem o miolo claro. */
  readonly isCanvas = computed(() => {
    const path = this.url().split('?')[0];
    return path === '/e' || path.startsWith('/e/') || path.startsWith('/previa');
  });

  readonly loginQuery = computed(() => {
    const path = this.url().split('?')[0];
    if (path.startsWith('/auth/')) {
      return {};
    }
    return { returnUrl: this.url() };
  });

  readonly sidenavOpen = signal(false);

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  onSidenavOpenedChange(opened: boolean): void {
    this.sidenavOpen.set(opened);
  }

  closeSidenav(): void {
    this.sidenavOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
