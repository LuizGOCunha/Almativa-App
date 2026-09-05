/** Erro de dominio com codigo estavel e status HTTP. */
export class ErroApp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroApp';
  }
}

export const naoEncontrado = (recurso: string, id?: string) =>
  new ErroApp(404, 'NAO_ENCONTRADO', id ? `${recurso} ${id} não encontrado.` : `${recurso} não encontrado.`);

export const requisicaoInvalida = (mensagem: string, detalhes?: unknown) =>
  new ErroApp(400, 'REQUISICAO_INVALIDA', mensagem, detalhes);

export const conflito = (mensagem: string, detalhes?: unknown) =>
  new ErroApp(409, 'CONFLITO', mensagem, detalhes);

export const naoAutorizado = (mensagem = 'Credenciais inválidas ou sessão expirada.') =>
  new ErroApp(401, 'NAO_AUTORIZADO', mensagem);

export const proibido = (mensagem = 'Você não tem permissão para esta ação.') =>
  new ErroApp(403, 'PROIBIDO', mensagem);
