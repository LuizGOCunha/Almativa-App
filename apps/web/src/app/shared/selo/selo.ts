import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { Rotulo } from '../../core/ui/rotulos';

/** Selo de status. Recebe o rótulo já resolvido pelos mapas de `rotulos.ts`. */
@Component({
  selector: 'app-selo',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="alm-selo" [class]="'alm-selo--' + rotulo().tom">
      @if (rotulo().icone && comIcone()) {
        <mat-icon>{{ rotulo().icone }}</mat-icon>
      }
      {{ rotulo().texto }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
  `,
})
export class Selo {
  readonly rotulo = input.required<Rotulo>();
  readonly comIcone = input(true);
}
