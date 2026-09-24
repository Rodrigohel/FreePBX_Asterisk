// TOTP (RFC 6238) implementado na mão com o crypto nativo do Node, sem
// depender de otplib/speakeasy — o algoritmo em si (HOTP, RFC 4226) é curto
// e estável, não precisa de uma dependência inteira só pra isso.
//
// Validado contra os vetores de teste oficiais do RFC 6238 (Apêndice B),
// que usam o secret ASCII "12345678901234567890": pros timestamps 59,
// 1111111109, 1111111111, 1234567890, 2000000000 e 20000000000, os códigos
// de 8 dígitos batem exatamente com o que a RFC documenta, e os últimos 6
// dígitos desses mesmos códigos batem com o generateToken() daqui (a
// truncagem dinâmica do RFC 4226 garante essa propriedade: (x mod 10^8) mod
// 10^6 == x mod 10^6).
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;

export function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// 20 bytes aleatórios em base32 — é o tamanho/formato que todo app
// autenticador (Google Authenticator, Authy, etc.) espera.
export function generateSecret() {
  return base32Encode(crypto.randomBytes(SECRET_BYTES));
}

// HOTP (RFC 4226): HMAC-SHA1 do contador (8 bytes big-endian), truncagem
// dinâmica, módulo 10^dígitos.
function hotp(secretBuffer, counter, digits = DIGITS) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, '0');
}

export function generateToken(base32Secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// Tolera até `window` passos de 30s de diferença de relógio com o celular
// (padrão: 1 passo pra cada lado, ±30s).
export function verifyToken(base32Secret, token, window = 1) {
  if (!base32Secret || !token) return false;
  const clean = String(token).trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const secretBuffer = base32Decode(base32Secret);
  for (let e = -window; e <= window; e += 1) {
    if (hotp(secretBuffer, counter + e) === clean) return true;
  }
  return false;
}

export function buildOtpauthUri({ secret, username, issuer }) {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// Códigos de recuperação de uso único (10 caracteres hex cada) pra quando a
// pessoa perde acesso ao app autenticador mas ainda quer entrar sem
// depender do admin.
export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}
