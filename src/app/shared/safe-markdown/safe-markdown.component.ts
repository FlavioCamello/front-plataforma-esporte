import { Component, Input } from '@angular/core';

import { renderSafeMarkdown } from '../../core/markdown/safe-markdown';

@Component({
  selector: 'app-safe-markdown',
  standalone: true,
  template: `
    @if (html) {
      <div class="md" [innerHTML]="html"></div>
    } @else if (emptyFallback) {
      <p class="md-empty">{{ emptyFallback }}</p>
    }
  `,
  styleUrl: './safe-markdown.component.scss',
})
export class SafeMarkdownComponent {
  html = '';

  @Input() emptyFallback = '';

  @Input()
  set source(value: string | null | undefined) {
    this.html = renderSafeMarkdown(value);
  }
}
