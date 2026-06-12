/** True if normalized identifier targets email signup/login. */
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '');
}

/** Register / OTP channel key: lowercase email OR compact phone (+237..., etc.). */
export function canonicalIdentifierFromRegister(
  email: string | undefined,
  phone: string | undefined,
): string {
  if (email?.trim()) {
    return normalizeEmail(email);
  }
  return normalizePhone(phone ?? '');
}

export function canonicalIdentifierFromUnknown(identifier: string): string {
  const t = identifier.trim();
  if (!t) {
    return '';
  }
  if (looksLikeEmail(t)) {
    return normalizeEmail(t);
  }
  return normalizePhone(t);
}
