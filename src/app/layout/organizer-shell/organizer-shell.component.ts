import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PUBLIC_EVENTS_ROUTE, USER_HOME_ROUTE } from '../../core/routing/app-routes';

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
  ],
  templateUrl: './organizer-shell.component.html',
  styleUrl: './organizer-shell.component.scss',
})
export class OrganizerShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly auth = inject(AuthService);
  readonly homeRoute = USER_HOME_ROUTE;
  readonly myEventsRoute = `${USER_HOME_ROUTE}/eventos`;
  readonly myRegistrationsRoute = `${USER_HOME_ROUTE}/inscricoes`;
  readonly createEventRoute = `${USER_HOME_ROUTE}/eventos/novo`;
  readonly publicEventsRoute = PUBLIC_EVENTS_ROUTE;

  readonly isOrganizer = computed(() => this.auth.currentUser()?.accountType === 'Organizer');

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  readonly sidenavOpen = signal(false);

  constructor() {
    effect(() => {
      if (!this.isHandset()) {
        this.sidenavOpen.set(true);
      }
    });
  }

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  onSidenavOpenedChange(opened: boolean): void {
    if (this.isHandset()) {
      this.sidenavOpen.set(opened);
    }
  }

  closeSidenavIfHandset(): void {
    if (this.isHandset()) {
      this.sidenavOpen.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
