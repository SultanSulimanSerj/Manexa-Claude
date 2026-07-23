'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Search, Check } from 'lucide-react'

export interface ClientOption {
  id: string
  name: string
  inn: string | null
  count: number
}

interface ClientFilterComboboxProps {
  clients: ClientOption[]
  value: string | null
  onChange: (id: string | null) => void
  totalCount: number
}

// Детерминированный цвет аватара по названию (палитра из дизайн-хендоффа)
const AVATAR_COLORS = ['#4338ca', '#0d9488', '#b45309', '#7c3aed', '#0369a1']
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function plural(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'проект'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'проекта'
  return 'проектов'
}

/**
 * Combobox-фильтр по контрагенту для таблицы проектов (дизайн-хендофф).
 * Триггер: белая кнопка (не выбран) / indigo-чип (выбран).
 * Поповер: поиск по названию/ИНН, аватары с инициалами, счётчики проектов.
 */
export function ClientFilterCombobox({ clients, value, onChange, totalCount }: ClientFilterComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => clients.find((c) => c.id === value) || null, [clients, value])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.inn || '').includes(q)
    )
  }, [clients, query])

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Автофокус на поиск при открытии
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const select = (id: string | null) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Триггер */}
      {selected ? (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 py-[6px] pl-[11px] pr-[6px] text-[13px]">
          <Building2 className="h-[14px] w-[14px] text-indigo-800" />
          <span className="text-neutral-500">Контрагент:</span>
          <span className="font-semibold text-neutral-900">{selected.name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              select(null)
            }}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
            aria-label="Сбросить фильтр по контрагенту"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white py-[7px] pl-[11px] pr-[9px] text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Building2 className="h-[14px] w-[14px] text-neutral-400" />
          Контрагент
          <span className="text-neutral-400">▾</span>
        </button>
      )}

      {/* Поповер */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_12px_32px_rgba(16,16,20,.14)]">
          {/* Поиск */}
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5">
            <Search className="h-[14px] w-[14px] shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или ИНН…"
              className="w-full bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              aria-label="Поиск контрагента"
            />
          </div>

          {/* Список */}
          <div className="max-h-[236px] overflow-y-auto p-1.5">
            {/* Все контрагенты */}
            <button
              type="button"
              onClick={() => select(null)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 ${
                value === null ? 'bg-indigo-50' : ''
              }`}
            >
              <span className="text-[13px] text-neutral-600">Все контрагенты</span>
              <span className="text-[11px] text-neutral-400">
                {totalCount} {plural(totalCount)}
              </span>
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-neutral-400">Ничего не найдено</p>
            ) : (
              filtered.map((c) => {
                const isSelected = c.id === value
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => select(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 ${
                      isSelected ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                      style={{ backgroundColor: avatarColor(c.name) }}
                    >
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-neutral-900">{c.name}</span>
                      <span className="block truncate text-[11px] text-neutral-400">
                        {[c.inn ? `ИНН ${c.inn}` : null, `${c.count} ${plural(c.count)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {isSelected && <Check className="h-[15px] w-[15px] shrink-0 text-[#4338ca]" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
