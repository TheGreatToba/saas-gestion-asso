import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${HASH_PREFIX}$`);
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!isPasswordHash(storedValue)) {
    return password === storedValue;
  }

  const [, salt, storedHash] = storedValue.split("$");
  if (!salt || !storedHash) return false;

  const computedHash = scryptSync(password, salt, 64).toString("hex");
  const computedBuffer = Buffer.from(computedHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (computedBuffer.length !== storedBuffer.length) return false;

  return timingSafeEqual(computedBuffer, storedBuffer);
}
