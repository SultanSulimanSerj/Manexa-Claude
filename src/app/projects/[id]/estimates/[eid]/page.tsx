'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/layout'
import { SkeletonList } from '@/components/ui/skeleton'
import { ErrorBanner } from '@/components/ui/error-banner'
import { toast } from '@/components/ui/use-toast'
import { Plus, Download, FileText, Trash2 } from 'lucide-react'

interface Item {
  id: string
  name: string
  unit: string
  quantity: string
  unitPrice: string
  costPrice: string
  vatRate: number | null
  category: string
}

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Черновик', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING: { label: 'На согласовании', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Утверждена', cls: 'bg-green-50 text-green-700 border-green-200' },
  ARCHIVED: { label: 'Архив', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}
const VAT_RATES = [20, 10, 7, 5, 0]
const UNITS = ['шт', 'м²', 'м³', 'м', 'т', 'кг', 'компл', 'услуга']
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
const fmtMln = (n: number) => (Math.abs(n) >= 1_000_000 ? (n / 1_000_000).toFixed(2).replace('.', ',') + ' млн' : fmt(n))
const num = (v: string) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }

export default function EstimateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id as string
  const estimateId = params?.eid as string

  const [projectName, setProjectName] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PENDING' | 'APPROVED' | 'ARCHIVED'>('DRAFT')
  const [contractNumber, setContractNumber] = useState<string | null>(null)
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatRate, setVatRate] = useState(20)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pRes, eRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/estimates/${estimateId}`),
      ])
      if (pRes.ok) setProjectName((await pRes.json()).name || '')
      if (eRes.ok) {
        const e = await eRes.json()
        setName(e.name || '')
        setStatus(e.status || 'DRAFT')
        setContractNumber(e.contractNumber || null)
        setVatEnabled(!!e.vatEnabled)
        setVatRate(Number(e.vatRate) || 20)
        setItems(
          (e.items || []).map((it: any) => ({
            id: it.id,
            name: it.name,
            unit: it.unit || 'шт',
            quantity: String(Number(it.quantity)),
            unitPrice: String(Number(it.unitPrice)),
            costPrice: String(Number(it.costPrice)),
            vatRate: it.vatRate != null ? Number(it.vatRate) : null,
            category: it.category || 'Без раздела',
          })),
        )
      } else {
        setError('Смета не найдена')
      }
    } catch {
      setError('Ошибка при загрузке сметы')
    } finally {
      setLoading(false)
    }
  }, [projectId, estimateId])

  useEffect(() => { load() }, [load])

  const patchItem = (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    setDirty(true)
  }
  const removeItem = (id: string) => { setItems((prev) => prev.filter((it) => it.id !== id)); setDirty(true) }
  const addItem = (category: string) => {
    setItems((prev) => [...prev, { id: `new_${Date.now()}`, name: '', unit: 'шт', quantity: '1', unitPrice: '0', costPrice: '0', vatRate: null, category }])
    setDirty(true)
  }
  const addSection = () => {
    const nm = window.prompt('Название раздела')?.trim()
    if (nm) addItem(nm)
  }

  // ——— расчёты ———
  const itemTotal = (it: Item) => num(it.quantity) * num(it.unitPrice)
  const itemCost = (it: Item) => num(it.quantity) * num(it.costPrice)
  const itemProfit = (it: Item) => itemTotal(it) - itemCost(it)
  const subtotalNoVat = items.reduce((s, it) => s + itemTotal(it), 0)
  const totalCost = items.reduce((s, it) => s + itemCost(it), 0)
  const profit = subtotalNoVat - totalCost
  const vatAmount = vatEnabled ? items.reduce((s, it) => s + itemTotal(it) * ((it.vatRate ?? vatRate) / 100), 0) : 0
  const totalWithVat = subtotalNoVat + vatAmount
  const margin = subtotalNoVat > 0 ? (profit / subtotalNoVat) * 100 : 0

  // группировка по разделам (категориям), порядок появления
  const sections: string[] = []
  items.forEach((it) => { if (!sections.includes(it.category)) sections.push(it.category) })

  const save = async (override?: { status?: string; contractNumber?: string | null }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/estimates/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Смета',
          vatEnabled,
          vatRate,
          status: override?.status ?? status,
          contractNumber: override?.contractNumber !== undefined ? override.contractNumber : contractNumber,
          items: items.map((it) => ({
            id: it.id,
            name: it.name,
            unit: it.unit,
            quantity: num(it.quantity),
            unitPrice: num(it.unitPrice),
            costPrice: num(it.costPrice),
            vatRate: it.vatRate,
            category: it.category,
          })),
        }),
      })
      if (res.ok) {
        const e = await res.json()
        setStatus(e.status)
        setContractNumber(e.contractNumber || null)
        setItems((e.items || []).map((it: any) => ({
          id: it.id, name: it.name, unit: it.unit || 'шт', quantity: String(Number(it.quantity)),
          unitPrice: String(Number(it.unitPrice)), costPrice: String(Number(it.costPrice)),
          vatRate: it.vatRate != null ? Number(it.vatRate) : null, category: it.category || 'Без раздела',
        })))
        setDirty(false)
        toast.success('Смета сохранена')
      } else {
        toast.error('Не удалось сохранить смету')
      }
    } catch {
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const toContract = async () => {
    const cn = window.prompt('Номер договора (например ДОГ-214)', contractNumber || '')?.trim()
    if (cn === undefined || cn === null) return
    await save({ status: 'APPROVED', contractNumber: cn || null })
    toast.success('Смета утверждена и привязана к договору')
  }

  const exportCsv = () => {
    const rows = [['Раздел', 'Позиция', 'Ед.', 'Кол-во', 'Цена', 'Себест.', 'Сумма', 'Прибыль']]
    items.forEach((it) => rows.push([it.category, it.name, it.unit, String(it.quantity), String(it.unitPrice), String(it.costPrice), String(itemTotal(it)), String(itemProfit(it))]))
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name || 'Смета'}.csv`
    a.click()
  }

  if (loading) {
    return <Layout><div className="space-y-6"><SkeletonList rows={8} /></div></Layout>
  }

  const st = STATUS[status]
  const cellInput = 'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] tabular-nums hover:border-neutral-200 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20'

  return (
    <Layout>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="space-y-4">
        {/* шапка */}
        <div>
          <div className="text-[12px] text-neutral-400">
            <button onClick={() => router.push(`/projects/${projectId}/estimates`)} className="hover:text-neutral-600">Проекты · {projectName}</button> · Сметы
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setDirty(true) }}
                className="rounded-md border border-transparent px-1 text-[22px] font-bold text-neutral-900 hover:border-neutral-200 focus:border-blue-400 focus:outline-none"
              />
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11.5px] font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dirty && (
                <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-60">
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              )}
              <button onClick={() => addItem(sections[sections.length - 1] || 'Работы')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Добавить позицию
              </button>
              <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50">
                <Download className="h-4 w-4" /> Экспорт
              </button>
              <button onClick={toContract} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-700 hover:bg-blue-100">
                <FileText className="h-4 w-4" /> В договор
              </button>
            </div>
          </div>
        </div>

        {/* сводка */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['Позиций', String(items.length), ''],
            ['Себестоимость', fmtMln(totalCost), ''],
            ['Сумма с НДС', fmtMln(totalWithVat), ''],
            ['Прибыль', `${profit >= 0 ? '+' : '−'}${fmtMln(Math.abs(profit))}`, 'green'],
            ['Маржа', `${margin.toFixed(1).replace('.', ',')}%`, 'green'],
          ].map(([label, value, tone], i) => (
            <div key={i} className={`rounded-xl border bg-white p-4 ${tone === 'green' ? 'border-green-200' : 'border-neutral-200'}`}>
              <div className={`text-[12px] font-medium ${tone === 'green' ? 'text-green-700' : 'text-neutral-400'}`}>{label}</div>
              <div className={`mt-1 text-[22px] font-bold tabular-nums ${tone === 'green' ? 'text-green-700' : 'text-neutral-900'}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* НДС-полоса */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-blue-700">Ставка НДС:</span>
          {VAT_RATES.map((r) => {
            const active = vatEnabled && vatRate === r
            return (
              <button
                key={r}
                onClick={() => { setVatEnabled(true); setVatRate(r); setDirty(true) }}
                className={`rounded-full px-3 py-1 text-[12.5px] ${active ? 'bg-blue-600 font-semibold text-white' : 'text-neutral-600 hover:bg-neutral-200'}`}
              >
                {r}%
              </button>
            )
          })}
          <button
            onClick={() => { setVatEnabled(false); setDirty(true) }}
            className={`rounded-full px-3 py-1 text-[12.5px] ${!vatEnabled ? 'bg-blue-600 font-semibold text-white' : 'text-neutral-600 hover:bg-neutral-200'}`}
          >
            Без НДС
          </button>
          <span className="ml-auto text-[11.5px] text-neutral-400">Можно задать на всю смету или на отдельную позицию</span>
        </div>

        {/* таблица позиций */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[2.4fr_0.7fr_0.8fr_1fr_1fr_1fr_1fr_36px] items-center border-b border-neutral-200 bg-neutral-50 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-neutral-400">
            <div className="py-2.5 pl-2">Позиция</div>
            <div className="py-2.5">Ед.</div>
            <div className="py-2.5 text-right">Кол-во</div>
            <div className="py-2.5 text-right">Цена</div>
            <div className="py-2.5 text-right">Себест.</div>
            <div className="py-2.5 text-right">Сумма</div>
            <div className="py-2.5 text-right">Прибыль</div>
            <div />
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-400">Позиций пока нет. Нажмите «Добавить позицию».</div>
          ) : (
            sections.map((sec) => {
              const secItems = items.filter((it) => it.category === sec)
              const secSum = secItems.reduce((s, it) => s + itemTotal(it), 0)
              return (
                <div key={sec}>
                  <div className="flex items-center justify-between border-t border-neutral-100 bg-blue-50/40 px-3 py-2">
                    <span className="pl-2 text-[13px] font-semibold text-blue-800">{sec}</span>
                    <span className="text-[12px] font-medium tabular-nums text-neutral-500">{fmt(secSum)}</span>
                  </div>
                  {secItems.map((it) => (
                    <div key={it.id} className="grid grid-cols-[2.4fr_0.7fr_0.8fr_1fr_1fr_1fr_1fr_36px] items-center border-t border-neutral-100 px-3 hover:bg-neutral-50/60">
                      <div className="py-1.5 pl-0">
                        <input value={it.name} onChange={(e) => patchItem(it.id, { name: e.target.value })} placeholder="Наименование" className={cellInput + ' text-left'} />
                      </div>
                      <div className="py-1.5">
                        <select value={it.unit} onChange={(e) => patchItem(it.id, { unit: e.target.value })} className={cellInput}>
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="py-1.5"><input value={it.quantity} onChange={(e) => patchItem(it.id, { quantity: e.target.value })} className={cellInput + ' text-right'} inputMode="decimal" /></div>
                      <div className="py-1.5"><input value={it.unitPrice} onChange={(e) => patchItem(it.id, { unitPrice: e.target.value })} className={cellInput + ' text-right'} inputMode="decimal" /></div>
                      <div className="py-1.5"><input value={it.costPrice} onChange={(e) => patchItem(it.id, { costPrice: e.target.value })} className={cellInput + ' text-right text-neutral-500'} inputMode="decimal" /></div>
                      <div className="py-1.5 pr-2 text-right text-[13px] font-medium tabular-nums text-neutral-900">{fmt(itemTotal(it))}</div>
                      <div className={`py-1.5 pr-2 text-right text-[13px] font-semibold tabular-nums ${num(it.costPrice) === 0 ? 'text-neutral-300' : itemProfit(it) >= 0 ? 'text-green-700' : 'text-red-600'}`} title={num(it.costPrice) === 0 ? 'Себестоимость не задана' : ''}>
                        {num(it.costPrice) === 0 ? '—' : `${itemProfit(it) >= 0 ? '+' : '−'}${fmt(Math.abs(itemProfit(it)))}`}
                      </div>
                      <div className="flex justify-center py-1.5">
                        <button onClick={() => removeItem(it.id)} className="text-neutral-300 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}

          {/* действия под таблицей */}
          <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-3 py-3">
            <button onClick={() => addItem(sections[sections.length - 1] || 'Работы')} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-[12.5px] text-neutral-600 hover:bg-neutral-50">
              <Plus className="h-3.5 w-3.5" /> Добавить позицию
            </button>
            <button onClick={addSection} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-[12.5px] text-neutral-600 hover:bg-neutral-50">
              Добавить раздел
            </button>
          </div>
        </div>

        {/* итоги */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex justify-between py-1 text-[13px]"><span className="text-neutral-500">Сумма без НДС</span><span className="font-medium tabular-nums text-neutral-900">{fmt(subtotalNoVat)}</span></div>
            <div className="flex justify-between py-1 text-[13px]"><span className="text-neutral-500">{vatEnabled ? `НДС ${vatRate}%` : 'Без НДС'}</span><span className="font-medium tabular-nums text-neutral-900">{fmt(vatAmount)}</span></div>
            <div className="mt-1 flex justify-between border-t border-neutral-100 pt-2 text-[15px] font-bold"><span>Итого с НДС</span><span className="tabular-nums">{fmt(totalWithVat)}</span></div>
            <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${profit >= 0 ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
              <span>Прибыль по смете</span>
              <span className="tabular-nums">{profit >= 0 ? '+' : '−'}{fmt(Math.abs(profit))} · {margin.toFixed(1).replace('.', ',')}%</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
