/**
 * Password protection for database files. An encrypted file is
 * MAGIC + salt + iv + AES-GCM ciphertext of the SQLite bytes. The key is
 * derived once with PBKDF2 and kept in memory only while the file is open;
 * every save uses a fresh IV.
 */
const MAGIC = new TextEncoder().encode("PIIKKI-CRYPT1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ITERATIONS = 600_000;

export type FileKey = { key: CryptoKey; salt: Uint8Array<ArrayBuffer> };

export class WrongPasswordError extends Error {
  constructor() {
    super("Väärä salasana.");
    this.name = "WrongPasswordError";
  }
}

export function isEncrypted(bytes: Uint8Array) {
  return bytes.length > MAGIC.length && MAGIC.every((byte, i) => bytes[i] === byte);
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<FileKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { key, salt };
}

/** Creates a key with a new random salt for a newly chosen password. */
export function createKey(password: string) {
  if (password.length < 4) throw new Error("Salasanan pitää olla vähintään 4 merkkiä.");
  return derive(password, crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

export async function encrypt(plain: Uint8Array, { key, salt }: FileKey) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(plain)),
  );
  const out = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES + cipher.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + SALT_BYTES);
  out.set(cipher, MAGIC.length + SALT_BYTES + IV_BYTES);
  return out;
}

function split(bytes: Uint8Array) {
  if (!isEncrypted(bytes)) throw new Error("Tiedosto ei ole salattu tietokanta.");
  const saltStart = MAGIC.length;
  const ivStart = saltStart + SALT_BYTES;
  const dataStart = ivStart + IV_BYTES;
  return {
    salt: bytes.slice(saltStart, ivStart),
    iv: bytes.slice(ivStart, dataStart),
    data: bytes.slice(dataStart),
  };
}

async function open(bytes: Uint8Array, fileKey: FileKey) {
  const { iv, data } = split(bytes);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, fileKey.key, data));
  } catch {
    throw new WrongPasswordError();
  }
}

/** Decrypts with a password and returns the key for later saves. */
export async function decrypt(bytes: Uint8Array, password: string) {
  const fileKey = await derive(password, split(bytes).salt);
  return { plain: await open(bytes, fileKey), fileKey };
}

/** Decrypts with a key that is already known, such as after saving a copy. */
export function decryptWithKey(bytes: Uint8Array, fileKey: FileKey) {
  return open(bytes, fileKey);
}
