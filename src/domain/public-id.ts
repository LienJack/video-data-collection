import { randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type PublicIdPrefix =
  | "PT"
  | "ST"
  | "DEV"
  | "TSK"
  | "AS"
  | "RS"
  | "UB"
  | "UP"
  | "UA"
  | "VA"
  | "RV";

export function createPublicId(prefix: PublicIdPrefix, length = 8): string {
  const bytes = randomBytes(length);
  let value = "";
  for (const byte of bytes) value += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${value}`;
}

export function isPublicId(value: string, prefix: PublicIdPrefix): boolean {
  return new RegExp(`^${prefix}-[${ALPHABET}]{6,16}$`).test(value);
}
