import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = 'Registro não encontrado.') => new HttpError(404, msg);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message || 'Dados inválidos.', field: first?.path.join('.') });
  }
  if ((err as any)?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
}

export function clientIp(req: Request) {
  return (req.ip || '').replace(/^::ffff:/, '');
}
