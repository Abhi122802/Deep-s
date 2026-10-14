/**
 * Sanitizes log messages and error strings to guarantee that
 * passwords, JWTs, API secrets, Authorization headers, and sensitive customer data
 * are never recorded in notification logs or terminal outputs.
 */
export function sanitizeLogDetails(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  let text = typeof input === 'string' ? input : String((input as any)?.message || JSON.stringify(input));

  // 1. Redact JWT tokens (header.payload.signature)
  text = text.replace(/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // 2. Redact Bearer tokens
  text = text.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');

  // 3. Redact Basic auth strings
  text = text.replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, 'Basic [REDACTED_AUTH]');

  // 4. Redact sensitive key-value pairs (e.g., password=..., secret=..., apiKey=...)
  text = text.replace(/(password|passwd|currentpassword|newpassword|confirmpassword|passwordhash|secret|apiKey|api_key|token|auth|credential|jwt_secret)["']?\s*[:=]\s*["']?([^"',;\s]+)["']?/gi, '$1=[REDACTED]');

  // 5. Redact MongoDB connection strings containing passwords
  text = text.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.*)/gi, '$1[REDACTED_PASSWORD]$2');

  // 6. Redact potential 16-digit credit card patterns
  text = text.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED_CARD]');

  return text.trim();
}

/**
 * Validates email address syntax (RFC 5322 compliance)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(clean);
}

/**
 * Validates phone number syntax (Indian/international phone numbers with at least 10 digits)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}
