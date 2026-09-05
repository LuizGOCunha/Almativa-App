import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Marca da Almativa em SVG: a folhagem, o lobo e a onda da logo original,
 * reduzidos ao essencial para funcionar bem em tamanhos pequenos.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      [attr.aria-label]="rotulo()"
    >
      <!-- folhagem -->
      <path
        [attr.stroke]="corFolha()"
        stroke-width="2.4"
        stroke-linecap="round"
        d="M13 30c0-9 6-16 15-18"
      />
      <ellipse [attr.fill]="corFolha()" cx="17.5" cy="21.5" rx="4.6" ry="3" transform="rotate(-38 17.5 21.5)" />
      <ellipse [attr.fill]="corFolha()" cx="24" cy="14.5" rx="4.6" ry="3" transform="rotate(-24 24 14.5)" />
      <ellipse [attr.fill]="corFolha()" cx="33" cy="10.5" rx="4.4" ry="2.9" transform="rotate(-8 33 10.5)" />

      <!-- lobo -->
      <path
        [attr.fill]="corPrimaria()"
        d="M40.5 15.5c1.4 1 2.1 2.6 2.1 4.4 0 3.2-1.9 5.6-4.6 7.4-2.6 1.7-4.3 3.4-5 5.4-.6 1.7-.6 3.6.2 5.6h-6.4c-.9-2.6-.7-5.3.5-7.9 1.3-2.8 3.6-5 6.4-6.7 1.9-1.2 2.9-2.3 2.9-3.6 0-.8-.3-1.4-.9-1.9l-2.5-2 4-2.6 3.3 1.9Z"
      />
      <circle [attr.fill]="corFundoOlho()" cx="36.2" cy="19.6" r="1.15" />

      <!-- onda -->
      <path
        [attr.stroke]="corOnda()"
        stroke-width="4.2"
        stroke-linecap="round"
        fill="none"
        d="M10 45c5.5-6 11-6 16.5-1.5S38 48 43.5 42s8.5-4.5 10.5-1"
      />
      <path
        [attr.stroke]="corPrimaria()"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
        opacity="0.5"
        d="M12 52.5c5-4.6 10-4.6 15 0s10 4.6 15 0 10-4.6 15 0"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class LogoAlmativa {
  readonly tamanho = input(40);
  /** `clara` inverte os tons para fundos escuros. */
  readonly variante = input<'escura' | 'clara'>('escura');
  readonly rotulo = input('Almativa');

  corPrimaria(): string {
    return this.variante() === 'clara' ? '#EAF3EC' : '#1E4D3B';
  }

  corFolha(): string {
    return this.variante() === 'clara' ? '#A8C48A' : '#88A86B';
  }

  corOnda(): string {
    return this.variante() === 'clara' ? '#7FBEBB' : '#5C9A98';
  }

  corFundoOlho(): string {
    return this.variante() === 'clara' ? '#1E4D3B' : '#F7F4EC';
  }
}
