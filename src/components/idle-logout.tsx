'use client'

import { useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

const IDLE_MS = 60 * 60 * 1000 // 1 час бездействия
const WRITE_THROTTLE_MS = 5000 // не чаще раза в 5с трогаем таймер/localStorage
const KEY = 'manexa_last_activity'
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']

/**
 * Автовыход по бездействию (1 час) с редиректом на страницу входа.
 * Работает для любого залогиненного пользователя. Учитывает простой
 * между перезагрузками/вкладками через localStorage.
 */
export function IdleLogout() {
  const { status } = useSession()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReset = useRef(0)

  useEffect(() => {
    if (status !== 'authenticated') return

    const doLogout = () => signOut({ callbackUrl: '/auth/signin?idle=1' })

    const reset = () => {
      localStorage.setItem(KEY, String(Date.now()))
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(doLogout, IDLE_MS)
    }

    // При монтировании: если простой уже превысил лимит — сразу выход
    const last = Number(localStorage.getItem(KEY) || 0)
    if (last && Date.now() - last > IDLE_MS) {
      doLogout()
      return
    }
    reset()
    lastReset.current = Date.now()

    const onActivity = () => {
      const now = Date.now()
      if (now - lastReset.current < WRITE_THROTTLE_MS) return
      lastReset.current = now
      reset()
    }
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    // Возврат на вкладку — пересверить простой
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const l = Number(localStorage.getItem(KEY) || 0)
      if (l && Date.now() - l > IDLE_MS) doLogout()
      else {
        lastReset.current = Date.now()
        reset()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timer.current) clearTimeout(timer.current)
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status])

  return null
}
