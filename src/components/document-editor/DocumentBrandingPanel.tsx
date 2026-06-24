'use client'

import { useEffect, useState } from 'react'
import { Stamp, PenLine } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface CompanyBrandingInfo {
  hasStamp: boolean
  hasSignature: boolean
  stampUrl: string | null
  signatureUrl: string | null
}

interface DocumentBrandingPanelProps {
  companyId: string | null | undefined
  includeStamp: boolean
  includeSignature: boolean
  onChange: (next: { includeStamp: boolean; includeSignature: boolean }) => void
  readOnly?: boolean
}

export function DocumentBrandingPanel({
  companyId,
  includeStamp,
  includeSignature,
  onChange,
  readOnly,
}: DocumentBrandingPanelProps) {
  const [branding, setBranding] = useState<CompanyBrandingInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!companyId) {
      setBranding(null)
      return
    }
    setLoading(true)
    fetch(`/api/company/${companyId}/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBranding(data))
      .catch(() => setBranding(null))
      .finally(() => setLoading(false))
  }, [companyId])

  if (!companyId || loading) return null
  if (!branding?.hasStamp && !branding?.hasSignature) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-neutral-50 p-3 text-sm text-muted-foreground">
        Печать и подпись не загружены —{' '}
        <a href="/settings" className="font-medium text-foreground underline-offset-2 hover:underline">
          добавить в настройках
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/70 bg-white shadow-xs divide-y divide-border/70">
      {branding.hasStamp && (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {branding.stampUrl ? (
              <img
                src={branding.stampUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md border border-border/70 object-contain bg-white"
              />
            ) : (
              <Stamp className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground">Печать</span>
          </div>
          <Switch
            checked={includeStamp}
            disabled={readOnly}
            aria-label="Печать при выгрузке"
            onCheckedChange={(v) => onChange({ includeStamp: v, includeSignature })}
          />
        </div>
      )}
      {branding.hasSignature && (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {branding.signatureUrl ? (
              <img
                src={branding.signatureUrl}
                alt=""
                className="h-9 w-14 shrink-0 rounded-md border border-border/70 object-contain bg-white"
              />
            ) : (
              <PenLine className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground">Подпись</span>
          </div>
          <Switch
            checked={includeSignature}
            disabled={readOnly}
            aria-label="Подпись при выгрузке"
            onCheckedChange={(v) => onChange({ includeStamp, includeSignature: v })}
          />
        </div>
      )}
    </div>
  )
}
