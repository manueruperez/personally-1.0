import crypto from 'node:crypto';

/**
 * Valida la firma `X-Hub-Signature-256` que Meta manda en cada webhook.
 *
 * Sin esto el endpoint es publico y cualquiera puede inyectar mensajes falsos:
 * el dispatcher los tomaria como mensajes reales del cliente y avanzaria su
 * rutina. Es el unico control de acceso que tiene la ruta.
 *
 * La firma es HMAC-SHA256 del cuerpo **crudo** con el APP_SECRET. Hay que
 * compararla sobre los bytes originales — si se re-serializa el JSON parseado,
 * cualquier diferencia de formato invalida la firma.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!rawBody || !header || !appSecret) return false;
  if (!header.startsWith('sha256=')) return false;

  const received = header.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // timingSafeEqual explota si los buffers difieren en largo, y comparar largos
  // primero no filtra nada util (el largo del hex es fijo).
  const a = Buffer.from(received, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
