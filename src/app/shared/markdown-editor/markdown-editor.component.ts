import { Component, ElementRef, Input, forwardRef, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent implements ControlValueAccessor {
  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');

  @Input() label = '';
  @Input() placeholder = '';
  @Input() rows = 5;
  @Input() maxlength: number | null = null;

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const next = (event.target as HTMLTextAreaElement).value;
    this.value = next;
    this.onChange(next);
  }

  wrap(prefix: string, suffix: string, emptyLabel = 'texto'): void {
    this.apply((start, end, selected) => {
      const inner = selected || emptyLabel;
      return {
        next: prefix + inner + suffix,
        selectFrom: prefix.length,
        selectTo: prefix.length + inner.length,
        start,
        end,
      };
    });
  }

  heading(): void {
    this.applyLinePrefix('## ');
  }

  list(): void {
    this.apply((start, end, selected) => {
      const block = selected || 'item';
      const next = block
        .split('\n')
        .map((line) => (line.startsWith('- ') ? line : `- ${line || 'item'}`))
        .join('\n');
      return { next, selectFrom: 0, selectTo: next.length, start, end };
    });
  }

  link(): void {
    this.wrap('[', '](https://)', 'texto do link');
  }

  private applyLinePrefix(prefix: string): void {
    this.apply((start, end, _selected, value) => {
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const already = value.slice(lineStart).startsWith(prefix);
      if (already) {
        return { next: value.slice(start, end), selectFrom: 0, selectTo: end - start, start, end };
      }
      const next = prefix + value.slice(lineStart, end);
      return {
        next,
        selectFrom: prefix.length,
        selectTo: next.length,
        start: lineStart,
        end,
      };
    });
  }

  private apply(
    mutate: (
      start: number,
      end: number,
      selected: string,
      value: string
    ) => { next: string; selectFrom: number; selectTo: number; start: number; end: number }
  ): void {
    if (this.disabled) {
      return;
    }

    const el = this.area()?.nativeElement;
    const start = el?.selectionStart ?? this.value.length;
    const end = el?.selectionEnd ?? this.value.length;
    const selected = this.value.slice(start, end);
    const result = mutate(start, end, selected, this.value);
    const next = this.value.slice(0, result.start) + result.next + this.value.slice(result.end);
    this.value = next;
    this.onChange(next);

    queueMicrotask(() => {
      const area = this.area()?.nativeElement;
      if (!area) {
        return;
      }
      area.focus();
      area.setSelectionRange(result.start + result.selectFrom, result.start + result.selectTo);
    });
  }

  markTouched(): void {
    this.onTouched();
  }
}
