'use client'

import { useEffect, useState } from 'react'
import { Stamp, PenLine } from 'lucide-react'

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
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Печать и подпись не загружены. Добавьте их в{' '}
        <a href="/settings" className="text-blue-600 hover:underline">
          настройках компании
        </a>
        .
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <p className="text-sm font-medium text-gray-900">Печать и подпись при выгрузке</p>
      <div className="flex flex-wrap gap-6">
        {branding.hasStamp && (
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeStamp}
              disabled={readOnly}
              onChange={(e) =>
                onChange({ includeStamp: e.target.checked, includeSignature })
              }
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium text-gray-800">
                <Stamp className="h-4 w-4" />
                Печать
              </span>
              {branding.stampUrl && (
                <img
                  src={branding.stampUrl}
                  alt="Печать"
                  className="mt-2 h-16 w-16 object-contain border rounded bg-white"
                />
              )}
            </span>
          </label>
        )}
        {branding.hasSignature && (
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeSignature}
              disabled={readOnly}
              onChange={(e) =>
                onChange({ includeStamp, includeSignature: e.target.checked })
              }
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium text-gray-800">
                <PenLine className="h-4 w-4" />
                Подпись
              </span>
              {branding.signatureUrl && (
                <img
                  src={branding.signatureUrl}
                  alt="Подпись"
                  className="mt-2 h-12 max-w-[140px] object-contain border rounded bg-white"
                />
              )}
            </span>
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Отметки применяются при нажатии «Сформировать». В шаблоне DOCX используйте теги{' '}
        <code className="text-[11px]">____&quot;signature&quot;_____</code> и{' '}
        <code className="text-[11px]">____&quot;stamp&quot;_____</code>.
      </p>
    </div>
  )
}
