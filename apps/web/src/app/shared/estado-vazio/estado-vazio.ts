import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Estado vazio padrão de listas e tabelas. */
@Component({
  selector: 'app-estado-vazio',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alm-vazio">
      <mat-icon>{{ icone() }}</mat-icon>
      <strong>{{ titulo() }}</strong>
      @if (descricao()) {
        <span>{{ descricao() }}</span>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class EstadoVazio {
  readonly titulo = input.required<string>();
  readonly descricao = input<string | null>(null);
  readonly icone = input('inbox');
}
