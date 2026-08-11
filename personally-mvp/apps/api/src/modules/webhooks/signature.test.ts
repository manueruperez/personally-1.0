import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from './signature.js';

const SECRET = 'app-secret-de-prueba';

function sign(body: Buffer | string, secret = SECRET): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyMetaSignature', () => {
  it('acepta una firma valida', () => {
    const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));

    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rechaza una firma calculada con otro secreto', () => {
    const body = Buffer.from('{"a":1}');

    expect(verifyMetaSignature(body, sign(body, 'otro-secreto'), SECRET)).toBe(false);
  });

  it('rechaza si el cuerpo cambio despues de firmar', () => {
    const firmado = Buffer.from('{"a":1}');
    const recibido = Buffer.from('{"a":2}');

    expect(verifyMetaSignature(recibido, sign(firmado), SECRET)).toBe(false);
  });

  it('rechaza sin header de firma', () => {
    expect(verifyMetaSignature(Buffer.from('{}'), undefined, SECRET)).toBe(false);
  });

  it('rechaza un header sin el prefijo sha256=', () => {
    const body = Buffer.from('{}');
    const hex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');

    expect(verifyMetaSignature(body, hex, SECRET)).toBe(false);
  });

  it('rechaza cuando no hay cuerpo crudo (express.json sin verify)', () => {
    expect(verifyMetaSignature(undefined, sign('{}'), SECRET)).toBe(false);
  });

  it('rechaza si el APP_SECRET no esta configurado', () => {
    const body = Buffer.from('{}');

    expect(verifyMetaSignature(body, sign(body), '')).toBe(false);
  });

  it('rechaza una firma de largo distinto sin explotar', () => {
    expect(verifyMetaSignature(Buffer.from('{}'), 'sha256=abcd', SECRET)).toBe(false);
  });

  it('rechaza una firma que no es hex valido sin explotar', () => {
    expect(verifyMetaSignature(Buffer.from('{}'), 'sha256=zzzz', SECRET)).toBe(false);
  });
});
