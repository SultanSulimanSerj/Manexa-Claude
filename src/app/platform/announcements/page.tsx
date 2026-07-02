'use client'

import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  body: string
  level: string
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdByEmail: string | null
  createdAt: string
  _count: { dismissals: number }
}

interface Form {
  title: string
  body: string
  level: string
  startsAt: string
  endsAt: string
}

const LEVELS: Record<string, { label: string; className: string }> = {
  INFO: { label: 'Инфо', className: 'bg-gray-100 text-gray-700' },
  WARNING: { label: 'Предупреждение', className: 'bg-amber-100 text-amber-800' },
  CRITICAL: { label: 'Важно', className: 'bg-red-100 text-red-800' },
}

export default function PlatformAnnouncementsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'PLATFORM_ADMIN'
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Form | null>(null)

  const fetchItems = () => {
    setLoading(true)
    fetch('/api/platform/announcements')
      .then((res) => (res.ok ? res.json() : { announcements: [] }))
      .then((data) => setItems(data.announcements || []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchItems, [])

  const create = async () => {
    if (!form) return
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Заполните заголовок и текст')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/platform/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          level: form.level,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Ошибка')
        return
      }
      toast.success('Анонс опубликован')
      setForm(null)
      fetchItems()
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (a: Announcement) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/announcements/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !a.isActive }),
      })
      if (res.ok) fetchItems()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: Announcement) => {
    if (!(await confirm(`Удалить анонс «${a.title}»?`))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/announcements/${a.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Удалено')
        fetchItems()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Анонсы</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setForm({ title: '', body: '', level: 'INFO', startsAt: '', endsAt: '' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Создать анонс
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Активные анонсы показываются всем пользователям компаний баннером вверху страницы. Каждый может скрыть анонс у себя.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">Анонсов нет</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const lvl = LEVELS[a.level] || LEVELS.INFO
            return (
              <div key={a.id} className={`rounded-xl border bg-white p-4 ${!a.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${lvl.className}`}>{lvl.label}</span>
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      {!a.isActive && <span className="text-xs text-gray-400">(выключен)</span>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {a.createdByEmail} · {new Date(a.createdAt).toLocaleDateString('ru-RU')}
                      {a.startsAt && ` · с ${new Date(a.startsAt).toLocaleDateString('ru-RU')}`}
                      {a.endsAt && ` · до ${new Date(a.endsAt).toLocaleDateString('ru-RU')}`}
                      {` · скрыли: ${a._count.dismissals}`}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(a)}
                        title={a.isActive ? 'Выключить' : 'Включить'}
                        className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                      >
                        {a.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(a)}
                        title="Удалить"
                        className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Форма создания */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setForm(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-gray-900">Новый анонс</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Заголовок</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Текст</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Уровень</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="INFO">Инфо</option>
                    <option value="WARNING">Предупреждение</option>
                    <option value="CRITICAL">Важно</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">С даты</label>
                  <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">По дату</label>
                  <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Публикация…' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
