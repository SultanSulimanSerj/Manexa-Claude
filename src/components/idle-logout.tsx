'use client'

import { useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

const IDLE_MS = 60 * 60 * 1000 // 1 час бездействия
const WRITE_THROTTLE_MS = 5000 // не чаще раза в 5с сбрасываем таймер
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']

/**
 * Автовыход по бездействию (1 час) с редиректом на страницу входа.
 * Таймер живёт только в пределах открытой вкладки-сессии (in-memory),
 * без кросс-перезагрузочной проверки — вход всегда даёт свежее окно.
 */
export function IdleLogout() {
  const { status } = useSession()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReset = useRef(0)

  useEffect(() => {
    if (status !== 'authenticated') return

    const doLogout = () => signOut({ callbackUrl: '/auth/signin?idle=1' })

    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(doLogout, IDLE_MS)
    }

    // Вход/монтирование = свежее окно бездействия (без чтения старых меток)
    reset()
    lastReset.current = Date.now()

    const onActivity = () => {
      const now = Date.now()
      if (now - lastReset.current < WRITE_THROTTLE_MS) return
      lastReset.current = now
      reset()
    }
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    return () => {
      if (timer.current) clearTimeout(timer.current)
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [status])

  return null
}
