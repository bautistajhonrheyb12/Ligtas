// Web Push using only the Web Crypto API (no libraries):
//   * VAPID (RFC 8292): proves to the push service that LIGTAS sent the message
//   * aes128gcm encryption (RFC 8291): only the phone can read the message
//   * delivery (RFC 8030): one POST to the phone's push service
//
// New VAPID keys (only needed if the private key leaks). Put both in
// supabase/.env.local and the public one in src/lib/push.js; phones switch to
// the new key by themselves the next time LIGTAS opens.
//   node -e "const k=require('crypto').generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'});console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),Buffer.from(k.x,'base64url'),Buffer.from(k.y,'base64url')]).toString('base64url')+'\nVAPID_PRIVATE_KEY='+k.d)"

export type PushTarget = { endpoint: string; p256dh: string; auth: string }
export type Vapid = { publicKey: string; privateKey: string; subject: string }
export type PushOptions = { ttl: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' }
export type PushResult = { status: number; ok: boolean; gone: boolean; detail: string }

const encoder = new TextEncoder()
// The whole message must fit in one 4096-byte record.
const RECORD_SIZE = 4096
export const MAX_PAYLOAD_BYTES = 3000

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

let signing: { privateKey: string; key: CryptoKey } | null = null

async function vapidSigningKey(vapid: Vapid): Promise<CryptoKey> {
  if (signing?.privateKey === vapid.privateKey) return signing.key
  const publicKey = base64UrlToBytes(vapid.publicKey)
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('VAPID_PUBLIC_KEY is not a P-256 public key.')
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapid.privateKey.replace(/=+$/, ''),
    x: bytesToBase64Url(publicKey.slice(1, 33)),
    y: bytesToBase64Url(publicKey.slice(33, 65)),
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  signing = { privateKey: vapid.privateKey, key }
  return key
}

// A VAPID token is valid for 12 hours; one is reused per push service until
// an hour before it expires.
const tokens = new Map<string, { token: string; expires: number }>()

export async function vapidToken(audience: string, vapid: Vapid): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const cached = tokens.get(audience)
  if (cached && cached.expires - now > 3600) return cached.token
  const expires = now + 12 * 3600
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({ aud: audience, exp: expires, sub: vapid.subject })))
  const unsigned = `${header}.${claims}`
  // Web Crypto returns the raw r||s signature, which is what ES256 expects.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidSigningKey(vapid), encoder.encode(unsigned)))
  const token = `${unsigned}.${bytesToBase64Url(signature)}`
  tokens.set(audience, { token, expires })
  return token
}

export async function encryptPayload(target: PushTarget, payload: Uint8Array): Promise<Uint8Array> {
  const phoneKey = base64UrlToBytes(target.p256dh)
  const authSecret = base64UrlToBytes(target.auth)
  if (phoneKey.length !== 65 || phoneKey[0] !== 4 || authSecret.length !== 16) throw new Error('The subscription keys are invalid.')
  if (payload.length > MAX_PAYLOAD_BYTES) throw new Error('The message is too long.')

  // A new key pair for every message.
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const phonePublic = await crypto.subtle.importKey('raw', phoneKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: phonePublic }, local.privateKey, 256))

  const ikm = await hkdf(authSecret, shared, concat(encoder.encode('WebPush: info\0'), phoneKey, localPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  // 0x02 marks the last (and only) record.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))))

  const header = new Uint8Array(16 + 4 + 1 + localPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = localPublic.length
  header.set(localPublic, 21)
  return concat(header, ciphertext)
}

export async function sendWebPush(target: PushTarget, payload: string, vapid: Vapid, options: PushOptions): Promise<PushResult> {
  const endpoint = new URL(target.endpoint)
  const body = await encryptPayload(target, encoder.encode(payload))
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(Math.max(0, Math.round(options.ttl))),
    Authorization: `vapid t=${await vapidToken(endpoint.origin, vapid)}, k=${vapid.publicKey.replace(/=+$/, '')}`,
  }
  if (options.urgency) headers.Urgency = options.urgency
  const response = await fetch(endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) })
  const detail = response.ok ? '' : (await response.text().catch(() => '')).slice(0, 200)
  // 404 and 410 mean the phone unsubscribed or the subscription expired.
  return { status: response.status, ok: response.ok, gone: response.status === 404 || response.status === 410, detail }
}
