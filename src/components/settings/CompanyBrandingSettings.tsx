'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Stamp, PenLine, Upload, Trash2, Loader2 } from 'lucide-react'

interface CompanyBrandingSettingsProps {
  companyId: string | null | undefined
}

export function CompanyBrandingSettings({ companyId }: CompanyBrandingSettingsProps) {
  const [hasStamp, setHasStamp] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<'stamp' | 'signature' | null>(null)
  const stampInputRef = useRef<HTMLInputElement>(null)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/company/${companyId}/branding`)
      if (!res.ok) return
      const data = await res.json()
      setHasStamp(Boolean(data.hasStamp))
      setHasSignature(Boolean(data.hasSignature))
      setStampUrl(data.stampUrl || null)
      setSignatureUrl(data.signatureUrl || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [companyId])

  const upload = async (type: 'stamp' | 'signature', file: File) => {
    if (!companyId) return
    setUploading(type)
    try {
      const form = new FormData()
      form.append('type', type)
      form.append('file', file)
      const res = await fetch(`/api/company/${companyId}/branding`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка загрузки')
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(null)
    }
  }

  const remove = async (type: 'stamp' | 'signature') => {
    if (!companyId) return
    setUploading(type)
    try {
      const res = await fetch(`/api/company/${companyId}/branding?type=${type}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Ошибка удаления')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setUploading(null)
    }
  }

  if (!companyId) return null

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Stamp className="h-5 w-5 mr-2 text-primary" />
          Печать и подпись
        </CardTitle>
        <CardDescription>
          PNG или JPEG с прозрачным фоном. Будут доступны при формировании документов (включение
          по выбору в каждом документе).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <Stamp className="h-4 w-4" />
                Печать организации
              </p>
              <div className="h-28 border rounded-lg bg-gray-50 flex items-center justify-center">
                {hasStamp && stampUrl ? (
                  <img src={stampUrl} alt="Печать" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <span className="text-sm text-gray-400">Не загружена</span>
                )}
              </div>
              <input
                ref={stampInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload('stamp', file)
                  e.target.value = ''
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading === 'stamp'}
                  onClick={() => stampInputRef.current?.click()}
                >
                  {uploading === 'stamp' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Загрузить
                </Button>
                {hasStamp && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'stamp'}
                    onClick={() => void remove('stamp')}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <PenLine className="h-4 w-4" />
                Подпись руководителя
              </p>
              <div className="h-28 border rounded-lg bg-gray-50 flex items-center justify-center">
                {hasSignature && signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Подпись"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-gray-400">Не загружена</span>
                )}
              </div>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload('signature', file)
                  e.target.value = ''
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading === 'signature'}
                  onClick={() => signatureInputRef.current?.click()}
                >
                  {uploading === 'signature' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Загрузить
                </Button>
                {hasSignature && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'signature'}
                    onClick={() => void remove('signature')}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
