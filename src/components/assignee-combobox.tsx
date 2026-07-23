'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

interface UserOption {
  id: string
  name: string
  email: string
  position?: string | null
}

interface AssigneeComboboxProps {
  users: UserOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

// Детерминированный цвет аватара по имени (палитра из дизайн-хендоффа)
const AVATAR_COLORS = ['#3b5bd9', '#0d9488', '#b45309', '#7c3aed', '#0369a1']
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

/**
 * Multi-select исполнителей: чипы + выпадающий список с чекбоксами и аватарами.
 * Замена <select multiple> (дизайн-хендофф, блок 1b).
 */
export function AssigneeCombobox({ users, value, onChange, placeholder = 'Добавить исполнителя…' }: AssigneeComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => users.filter((u) => value.includes(u.id)), [users, value])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, query])

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) toggle(filtered[0].id)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Поле с чипами */}
      <div
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
        className={`flex min-h-[42px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 transition-colors ${
          open ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200'
        }`}
      >
        {selected.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pl-0.5 pr-2 text-[12.5px] font-medium text-neutral-700"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(u.name) }}
            >
              {initials(u.name)}
            </span>
            {u.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggle(u.id)
              }}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label={`Убрать ${u.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent py-1 text-[13.5px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          aria-label="Поиск исполнителей"
        />
      </div>

      {/* Выпадающий список */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[240px] overflow-y-auto rounded-[10px] border border-neutral-200 bg-white p-1.5 shadow-[0_8px_20px_rgba(16,16,20,.10)]">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-neutral-400">Никого не найдено</p>
          ) : (
            filtered.map((u) => {
              const isSelected = value.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                      isSelected ? 'bg-neutral-900' : 'border-[1.5px] border-neutral-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: avatarColor(u.name) }}
                  >
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-neutral-900">{u.name}</span>
                    <span className="block truncate text-[11.5px] text-neutral-400">
                      {[u.position, u.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
