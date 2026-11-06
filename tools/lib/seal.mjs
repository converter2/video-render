// AES-256-GCM sealing shared by both repositories. The same file is copied into the private repo as src/seal.mjs.
// Layout: 1 byte version | 12 byte IV | 16 byte tag | ciphertext.
import crypto from 'node:crypto';

export function keyFrom(secret) {
  const s = String(secret || '').trim();
  if (!s) throw new Error('JOB_KEY is not set');
  const raw = /^[0-9a-f]{64}$/i.test(s) ? Buffer.from(s, 'hex') : crypto.createHash('sha256').update(s).digest();
  return raw;
}

export function seal(data, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(Buffer.isBuffer(data) ? data : Buffer.from(String(data))), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), body]);
}

export function open(buf, key) {
  buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (buf[0] !== 1 || buf.length < 29) throw new Error('not a sealed file');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(1, 13));
  d.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([d.update(buf.subarray(29)), d.final()]);
}

/** Stable, unlinkable file name for a job id. */
export function fileKey(id, key) {
  return crypto.createHmac('sha256', key).update('file:' + id).digest('hex').slice(0, 24);
}

export const sealJson = (v, key) => seal(JSON.stringify(v), key).toString('base64');
export const openJson = (b64, key) => JSON.parse(open(Buffer.from(String(b64).trim(), 'base64'), key).toString('utf8'));
