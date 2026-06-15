import { prisma } from './prisma'
import { invalidateCompanyAccessCache } from './subscription-guard'

const PAST_DUE_GRACE_DAYS = 7

/**
 * Проверка статусов подписок:
 * - TRIAL/ACTIVE с истёкшим периодом → PAST_DUE
 * - PAST_DUE дольше 7 дней после конца периода → SUSPENDED
 */
export async function runSubscriptionStatusCheck(): Promise<{ pastDue: number; suspended: number }> {
  const now = new Date()

  const toPastDue = await prisma.subscription.updateMany({
    where: {
      status: { in: ['TRIAL', 'ACTIVE'] },
      currentPeriodEnd: { lt: now },
    },
    data: { status: 'PAST_DUE' },
  })

  const suspendBefore = new Date(now)
  suspendBefore.setDate(suspendBefore.getDate() - PAST_DUE_GRACE_DAYS)

  const toSuspendList = await prisma.subscription.findMany({
    where: {
      status: 'PAST_DUE',
      currentPeriodEnd: { lt: suspendBefore },
    },
    select: { id: true, companyId: true },
  })

  if (toSuspendList.length > 0) {
    await prisma.subscription.updateMany({
      where: { id: { in: toSuspendList.map((s) => s.id) } },
      data: { status: 'SUSPENDED' },
    })
    for (const sub of toSuspendList) {
      invalidateCompanyAccessCache(sub.companyId)
    }
  }

  if (toPastDue.count > 0 || toSuspendList.length > 0) {
    console.log(
      `[subscription-cron] PAST_DUE: ${toPastDue.count}, SUSPENDED: ${toSuspendList.length}`
    )
  }

  return { pastDue: toPastDue.count, suspended: toSuspendList.length }
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // каждые 6 часов

/** Периодическая проверка статусов (запускается в процессе воркера). */
export function startSubscriptionCron() {
  runSubscriptionStatusCheck().catch((err) =>
    console.error('[subscription-cron] initial check failed:', err)
  )
  setInterval(() => {
    runSubscriptionStatusCheck().catch((err) =>
      console.error('[subscription-cron] check failed:', err)
    )
  }, CHECK_INTERVAL_MS)
  console.log('[subscription-cron] started (interval: 6h)')
}
