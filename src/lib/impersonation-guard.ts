import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Защита при impersonation (PLATFORM_ADMIN вошёл под учёткой клиента).
 *
 * В режиме поддержки разрешены чтение и обычная работа, но блокируются
 * юридически значимые и необратимые действия: согласование/подпись,
 * смена пароля/почты/2FA, финансы/оплаты, правка реквизитов, удаление,
 * публикация документов. Так действие нельзя атрибутировать пользователю
 * без его ведома.
 */

/** true, если текущая сессия — impersonation. */
export async function isImpersonatedRequest(request: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    return !!(token as { impersonatedBy?: string | null })?.impersonatedBy
  } catch {
    return false
  }
}

/**
 * Возвращает 403-ответ, если запрос выполняется в режиме impersonation.
 * Вызывать в начале мутирующих юр-значимых эндпоинтов:
 *   const blocked = await blockIfImpersonated(request)
 *   if (blocked) return blocked
 */
export async function blockIfImpersonated(request: NextRequest): Promise<NextResponse | null> {
  if (await isImpersonatedRequest(request)) {
    return NextResponse.json(
      {
        error:
          'Действие недоступно в режиме поддержки (вход от имени пользователя). Выполните его от своей учётной записи.',
      },
      { status: 403 }
    )
  }
  return null
}
