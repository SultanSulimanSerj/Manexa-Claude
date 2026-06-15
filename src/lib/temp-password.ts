import crypto from 'crypto'

// Без неоднозначных символов (0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/** Временный пароль для передачи вручную: 12 символов, читаемый. */
export function generateTempPassword(length = 12): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return result
}
