import type { Role } from '@almativa/shared';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware autenticar(). */
      usuario?: {
        id: string;
        email: string;
        nome: string;
        role: Role;
        alunoId: string | null;
        /** Presente apenas para tokens de dispositivo (perfil AULA). */
        dispositivoId?: string;
      };
    }
  }
}

export {};
