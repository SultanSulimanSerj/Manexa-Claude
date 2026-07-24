import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { logPlatformAction } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

/**
 * Завершение impersonation-сессии: пишет аудит IMPERSONATE_END.
 * Вызывается из баннера «Режим поддержки» перед signOut.
 * Доступно только внутри impersonation-сессии (в токене есть impersonatedBy).
 */
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const impersonatedBy = (token as { impersonatedBy?: string | null })?.impersonatedBy
  const targetUserId = token?.sub

  if (!impersonatedBy || !targetUserId) {
    return NextResponse.json({ error: 'Не режим поддержки' }, { status: 400 })
  }

  const admin = await prisma.user.findUnique({
    where: { id: impersonatedBy },
    select: { email: true },
  })

  await logPlatformAction({
    actorId: impersonatedBy,
    actorEmail: admin?.email,
    action: 'IMPERSONATE_END',
    targetType: 'User',
    targetId: targetUserId,
    metadata: { targetEmail: (token.email as string) || null },
    request,
  })

  return NextResponse.json({ ok: true })
}
