'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePagination } from '@/components/ui/pagination'
import { Tooltip } from '@/components/ui/tooltip'
import { confirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/use-toast'
import { Plus, Search, Package, Trash2, ArrowDownToLine, ArrowUpFromLine, Settings2 } from 'lucide-react'

interface Material {
  id: string
  name: string
  unit: string
  sku: string | null
  category: string | null
  minStock: number | null
  price: number | null
  balance: number
  lowStock: boolean
}

interface Project {
  id: string
  name: string
}

const MOVEMENT_META: Record<string, { label: string; verb: string }> = {
  RECEIPT: { label: 'Поступление', verb: 'Оприходовать' },
  ISSUE: { label: 'Списание на объект', verb: 'Списать' },
  ADJUSTMENT: { label: 'Корректировка', verb: 'Скорректировать' },
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(n)
}
function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', unit: 'шт', sku: '', category: '', minStock: '', price: '' })
  const [saving, setSaving] = useState(false)

  const [moveFor, setMoveFor] = useState<Material | null>(null)
  const [moveForm, setMoveForm] = useState({ type: 'RECEIPT', quantity: '', price: '', projectId: '', note: '' })

  const fetchMaterials = async () => {
    try {
      setLoadError(null)
      const res = await fetch('/api/materials')
      if (res.ok) {
        const data = await res.json()
        setMaterials(data.materials || [])
      } else {
        const d = await res.json().catch(() => ({}))
        setLoadError(d.error || 'Не удалось загрузить материалы')
      }
    } catch {
      setLoadError('Ошибка при загрузке материалов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMaterials()
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects || []))
      .catch(() => {})
  }, [])

  const filtered = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.sku || '').toLowerCase().includes(search.toLowerCase())
  )
  const { pageItems, Pagination } = usePagination(filtered, 20)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (res.ok) {
        setShowCreate(false)
        setCreateForm({ name: '', unit: 'шт', sku: '', category: '', minStock: '', price: '' })
        toast.success('Материал добавлен')
        fetchMaterials()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Ошибка при создании')
      }
    } finally {
      setSaving(false)
    }
  }

  const openMove = (m: Material, type: string) => {
    setMoveForm({ type, quantity: '', price: '', projectId: '', note: '' })
    setMoveFor(m)
  }

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!moveFor) return
    setSaving(true)
    try {
      const res = await fetch(`/api/materials/${moveFor.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moveForm),
      })
      if (res.ok) {
        setMoveFor(null)
        toast.success('Движение проведено')
        fetchMaterials()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Ошибка при проведении')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: Material) => {
    const ok = await confirm({
      title: 'Удалить материал?',
      description: `«${m.name}» и все его движения будут удалены.`,
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    const res = await fetch(`/api/materials/${m.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMaterials((prev) => prev.filter((x) => x.id !== m.id))
      toast.success('Материал удалён')
    } else {
      toast.error('Ошибка при удалении')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Материалы" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
        <PageHeader
          title="Материалы"
          description={`${materials.length} позиций на складе`}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Добавить материал
            </button>
          }
        />

        <div className="bg-white rounded-xl p-4 border border-border/70">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по наименованию или артикулу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/55"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={materials.length === 0 ? 'Склад пуст' : 'Ничего не найдено'}
            description={
              materials.length === 0
                ? 'Добавьте первый материал, затем проводите поступления и списания.'
                : 'Попробуйте изменить поиск.'
            }
            action={
              materials.length === 0 ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Добавить материал
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-border/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-neutral-50/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Материал</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Артикул</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500">Категория</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500">Остаток</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500">Цена</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageItems.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 max-w-[280px]">
                        <Tooltip content={m.name} className="block max-w-full">
                          <span className="block truncate text-sm font-medium text-neutral-900">{m.name}</span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{m.sku || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{m.category || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            m.lowStock ? 'text-red-600' : 'text-neutral-900'
                          }`}
                        >
                          {fmtNum(m.balance)} {m.unit}
                        </span>
                        {m.lowStock && (
                          <div className="text-[11px] text-red-500">мин. {fmtNum(m.minStock || 0)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{fmtMoney(m.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openMove(m, 'RECEIPT')}
                            title="Поступление"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openMove(m, 'ISSUE')}
                            title="Списать на объект"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openMove(m, 'ADJUSTMENT')}
                            title="Корректировка"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            title="Удалить"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination />
          </div>
        )}

        {/* Создание материала */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый материал</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Наименование *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ед. изм.</label>
                  <input
                    value={createForm.unit}
                    onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
                  <input
                    value={createForm.sku}
                    onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                  <input
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Мин. остаток</label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.minStock}
                    onChange={(e) => setCreateForm({ ...createForm, minStock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена, ₽</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.price}
                    onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Добавить'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Движение по складу */}
        <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {MOVEMENT_META[moveForm.type]?.label} — {moveFor?.name}
              </DialogTitle>
            </DialogHeader>
            {moveFor && (
              <form onSubmit={handleMove} className="space-y-4">
                <div className="text-sm text-gray-500">
                  Текущий остаток: <span className="font-medium text-neutral-900">{fmtNum(moveFor.balance)} {moveFor.unit}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Количество, {moveFor.unit} *
                    {moveForm.type === 'ADJUSTMENT' && (
                      <span className="text-gray-400 font-normal"> (можно отрицательное)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={moveForm.quantity}
                    onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })}
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                {moveForm.type === 'RECEIPT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена за ед., ₽</label>
                    <input
                      type="number"
                      step="0.01"
                      value={moveForm.price}
                      onChange={(e) => setMoveForm({ ...moveForm, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                    />
                  </div>
                )}
                {moveForm.type === 'ISSUE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">На объект (проект)</label>
                    <select
                      value={moveForm.projectId}
                      onChange={(e) => setMoveForm({ ...moveForm, projectId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring/55"
                    >
                      <option value="">— не указан —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
                  <input
                    value={moveForm.note}
                    onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/55"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMoveFor(null)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? '...' : MOVEMENT_META[moveForm.type]?.verb}
                  </button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}
