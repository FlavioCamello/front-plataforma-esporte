import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  templateUrl: './brand-mark.component.html',
  styleUrl: './brand-mark.component.scss',
})
export class BrandMarkComponent {
  /** `dark` para fundo Noite (vitrine). `light` para Areia e branco. */
  readonly tone = input<'light' | 'dark'>('light');
  readonly word = input(true);
}
