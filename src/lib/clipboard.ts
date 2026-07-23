/**
 * Копирование в буфер обмена с fallback.
 *
 * navigator.clipboard доступен только в secure context (HTTPS/localhost).
 * Приложение может работать по http:// на IP — там clipboard API недоступен,
 * поэтому используем запасной путь через скрытый textarea + execCommand('copy').
 */
export async function copyText(text: string): Promise<boolean> {
  // Основной путь — современный API (secure context)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // упадём в fallback ниже
  }

  // Fallback: скрытый textarea + execCommand (работает по http)
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
