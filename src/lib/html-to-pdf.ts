/**
 * Конвертация HTML → PDF через Gotenberg (Chromium).
 * Требует GOTENBERG_URL (тот же сервис, что для office-конвертации).
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL
  if (!gotenbergUrl) {
    throw new Error('GOTENBERG_URL не задан — не могу сформировать PDF')
  }
  const base = gotenbergUrl.replace(/\/$/, '')
  const formData = new FormData()
  formData.append('files', new Blob([html], { type: 'text/html' }), 'index.html')
  formData.append('paperWidth', '8.27')
  formData.append('paperHeight', '11.69')
  formData.append('marginTop', '0.4')
  formData.append('marginBottom', '0.4')
  formData.append('marginLeft', '0.4')
  formData.append('marginRight', '0.4')
  formData.append('printBackground', 'true')

  const response = await fetch(`${base}/forms/chromium/convert/html`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Gotenberg (${response.status}): ${text || 'ошибка конвертации HTML'}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
