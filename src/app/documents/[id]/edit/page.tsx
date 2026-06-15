'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Layout from '@/components/layout'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  DocumentEditorHeader,
  type DocumentApprovalStatus,
} from '@/components/document-editor/DocumentEditorHeader'
import { UpdEditor } from '@/components/document-editor/UpdEditor'
import { InvoiceEditor } from '@/components/document-editor/InvoiceEditor'
import { CommercialOfferEditor } from '@/components/document-editor/CommercialOfferEditor'
import { ContractEditor } from '@/components/document-editor/ContractEditor'
import { DocumentVersionHistory } from '@/components/document-editor/DocumentVersionHistory'
import { DocumentBrandingPanel } from '@/components/document-editor/DocumentBrandingPanel'
import { useSession } from 'next-auth/react'
import { LegacyDocumentNotice } from '@/components/document-editor/LegacyDocumentNotice'
import { FnsDraftPreview } from '@/components/document-editor/FnsDraftPreview'
import type { DocumentContent, UpdDocumentContent } from '@/lib/document-editor/types'
import {
  isUpdContent,
  isInvoiceContent,
  isKs2Content,
  isKs3Content,
  isServiceActContent,
  isCommercialOfferContent,
  isContractContent,
  isEditableDocumentContent,
} from '@/lib/document-editor/types'
import type {
  InvoiceDocumentContent,
  CommercialOfferDocumentContent,
  ContractDocumentContent,
  DocumentSourceMeta,
} from '@/lib/document-editor/types'
import { getDocumentTypeDefinition } from '@/lib/document-editor/registry'
import { appendUpdSourceMetaWarnings } from '@/lib/document-editor/upd-validator'
import { getDocumentContentType } from '@/lib/document-editor/types'
import {
  useDocumentExportPoll,
  type ExportJobStatus,
} from '@/hooks/use-document-export-poll'

interface DocumentRecord {
  id: string
  title: string
  fileName: string
  filePath: string
  fileSize: number
  pdfFileName?: string | null
  pdfFilePath?: string | null
  pdfFileSize?: number | null
  editorStatus: string
  hasUnpublishedChanges?: boolean
  contentJson: unknown
  lastExportedAt: string | null
  updatedAt?: string
  hasEditableContent?: boolean
  project?: { id: string; name: string } | null
  sourceMeta?: DocumentSourceMeta | null
  category?: string | null
  includeStampOnExport?: boolean
  includeSignatureOnExport?: boolean
}

export default function DocumentEditPage() {
  const params = useParams()
  const documentId = params?.id as string
  const { data: session } = useSession()

  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [content, setContent] = useState<DocumentContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [exporting, setExporting] = useState(false)
  const [exportStatusLabel, setExportStatusLabel] = useState<string | null>(null)
  const { pollExportJob, cancelPoll } = useDocumentExportPoll()
  const [dirty, setDirty] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<{ current: unknown; versions: unknown[] } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [exportError, setExportError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(true)
  const [sourceInvoice, setSourceInvoice] = useState<{ id: string; title: string } | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<DocumentApprovalStatus | null>(null)
  const [pendingExportJob, setPendingExportJob] = useState<{
    id: string
    status: ExportJobStatus
  } | null>(null)
  const [includeStamp, setIncludeStamp] = useState(false)
  const [includeSignature, setIncludeSignature] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<DocumentContent | null>(null)
  const resumedJobIdRef = useRef<string | null>(null)

  useEffect(() => {
    const invoiceId = (document?.sourceMeta as DocumentSourceMeta | null | undefined)
      ?.invoiceDocumentId
    if (!invoiceId) {
      setSourceInvoice(null)
      return
    }
    let cancelled = false
    fetch(`/api/documents/${invoiceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.document) return
        setSourceInvoice({ id: invoiceId, title: data.document.title || 'Счёт' })
      })
      .catch(() => {
        if (!cancelled) setSourceInvoice({ id: invoiceId, title: 'Счёт' })
      })
    return () => {
      cancelled = true
    }
  }, [document?.sourceMeta])

  const exportStatusText = (status: ExportJobStatus) => {
    if (status === 'QUEUED') return 'В очереди…'
    if (status === 'PROCESSING') return 'Формирование файлов…'
    return 'Формирование…'
  }

  const fetchDocument = useCallback(async () => {
    try {
      setLoadError(null)
      const res = await fetch(`/api/documents/${documentId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось загрузить документ')
      }
      const data = await res.json()
      setDocument(data.document)
      setIncludeStamp(Boolean(data.document.includeStampOnExport))
      setIncludeSignature(Boolean(data.document.includeSignatureOnExport))
      setCanEdit(data.canEdit !== false)

      const activeJob = data.activeExportJob
      if (
        activeJob?.id &&
        activeJob.status !== 'COMPLETED' &&
        activeJob.status !== 'FAILED' &&
        resumedJobIdRef.current !== activeJob.id
      ) {
        resumedJobIdRef.current = activeJob.id
        setPendingExportJob({ id: activeJob.id, status: activeJob.status })
      }

      if (data.document.contentJson && isEditableDocumentContent(data.document.contentJson)) {
        setContent(data.document.contentJson)
        contentRef.current = data.document.contentJson
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  // Статус согласования документа для бейджа в шапке
  useEffect(() => {
    let cancelled = false
    fetch(`/api/approvals?documentId=${documentId}&limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const approval = data?.approvals?.[0]
        setApprovalStatus(approval?.status ?? null)
      })
      .catch(() => {
        if (!cancelled) setApprovalStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  useEffect(() => {
    return () => cancelPoll()
  }, [cancelPoll])

  useEffect(() => {
    if (!pendingExportJob) return

    const job = pendingExportJob
    const pollUrl = `/api/documents/export-jobs/${job.id}`
    let cancelled = false

    void (async () => {
      setExporting(true)
      setExportStatusLabel(exportStatusText(job.status))
      try {
        const result = await pollExportJob(pollUrl, (job) => {
          setExportStatusLabel(exportStatusText(job.status))
        })
        if (cancelled) return
        if (result.document) {
          setDocument((prev) =>
            prev ? { ...prev, ...(result.document as DocumentRecord) } : prev
          )
        }
        await fetchDocument()
      } catch (err) {
        if (!cancelled) {
          setExportError(err instanceof Error ? err.message : 'Ошибка экспорта')
        }
      } finally {
        if (!cancelled) {
          setExporting(false)
          setExportStatusLabel(null)
          setPendingExportJob(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pendingExportJob?.id, pollExportJob, fetchDocument])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const saveContent = useCallback(
    async (silent = false) => {
      const current = contentRef.current
      if (!current) return false
      if (!silent) setSaveStatus('saving')
      try {
        const res = await fetch(`/api/documents/${documentId}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: current }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Ошибка сохранения')
        }
        const data = await res.json()
        setDocument((prev) => (prev ? { ...prev, ...data.document } : prev))
        if (isEditableDocumentContent(data.document.contentJson)) {
          setContent(data.document.contentJson)
          contentRef.current = data.document.contentJson
        }
        setDirty(false)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
        return true
      } catch {
        setSaveStatus('error')
        return false
      }
    },
    [documentId]
  )

  const handleContentChange = (next: DocumentContent) => {
    if (!canEdit) return
    setContent(next)
    contentRef.current = next
    setDirty(true)
    setSaveStatus('idle')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveContent(true)
    }, 2500)
  }

  const handleExport = async (format: 'both' | 'xlsx' | 'pdf' = 'both') => {
    setExportError(null)
    const current = contentRef.current
    if (!current) return

    const typeDef = getDocumentTypeDefinition(getDocumentContentType(current))
    let validation = typeDef.validate?.(current) ?? { valid: true, issues: [] }
    if (isUpdContent(current)) {
      validation = appendUpdSourceMetaWarnings(
        validation,
        document?.sourceMeta as DocumentSourceMeta | null | undefined
      )
    }
    const errors: Record<string, string> = {}
    validation.issues
      .filter((i) => i.severity === 'error')
      .forEach((i) => {
        errors[i.field] = i.message
      })
    setValidationErrors(errors)
    if (!validation.valid) {
      setExportError('Исправьте ошибки перед формированием файлов')
      return
    }

    if (dirty) {
      const saved = await saveContent(true)
      if (!saved) return
    }

    const isDocxExport =
      isCommercialOfferContent(current) ||
      isInvoiceContent(current) ||
      isContractContent(current)

    setExporting(true)
    setExportStatusLabel(isDocxExport ? 'Формирование…' : 'Отправка в очередь…')
    try {
      const res = await fetch(`/api/documents/${documentId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publish: false,
          format,
          content: current,
          includeStamp,
          includeSignature,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.status === 'completed') {
        await fetchDocument()
        setExporting(false)
        setExportStatusLabel(null)
        return
      }

      if (!res.ok) {
        if (data.issues) {
          const issueErrors: Record<string, string> = {}
          data.issues
            .filter((i: { severity: string }) => i.severity === 'error')
            .forEach((i: { field: string; message: string }) => {
              issueErrors[i.field] = i.message
            })
          setValidationErrors(issueErrors)
        }
        if (res.status === 409 && data.pollUrl) {
          setExportStatusLabel('Ожидание текущего экспорта…')
          const result = await pollExportJob(data.pollUrl, (job) => {
            setExportStatusLabel(exportStatusText(job.status))
          })
          if (result.document) {
            setDocument((prev) =>
              prev ? { ...prev, ...(result.document as DocumentRecord) } : prev
            )
          }
          await fetchDocument()
          return
        }
        throw new Error(data.error || 'Ошибка экспорта')
      }

      if (data.status === 'completed' && data.document) {
        setDocument((prev) => (prev ? { ...prev, ...data.document } : prev))
        await fetchDocument()
        return
      }

      if (data.pollUrl && data.job) {
        setExportStatusLabel(exportStatusText(data.job.status))
        const result = await pollExportJob(data.pollUrl, (job) => {
          setExportStatusLabel(exportStatusText(job.status))
        })
        if (result.document) {
          setDocument((prev) =>
            prev ? { ...prev, ...(result.document as DocumentRecord) } : prev
          )
        }
        await fetchDocument()
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Ошибка экспорта')
    } finally {
      setExporting(false)
      setExportStatusLabel(null)
    }
  }

  const downloadCacheKey =
    document?.lastExportedAt || document?.updatedAt || String(Date.now())

  const handleDownloadXlsx = () => {
    window.open(
      `/api/documents/${documentId}/download?t=${encodeURIComponent(downloadCacheKey)}`,
      '_blank'
    )
  }

  const handleDownloadPdf = () => {
    window.open(
      `/api/documents/${documentId}/download?format=pdf&t=${encodeURIComponent(downloadCacheKey)}`,
      '_blank'
    )
  }

  const loadVersions = async () => {
    const res = await fetch(`/api/documents/${documentId}/versions`)
    if (res.ok) {
      const data = await res.json()
      setVersions(data)
    }
  }

  const handleToggleVersions = async () => {
    if (!showVersions) await loadVersions()
    setShowVersions((v) => !v)
  }

  const handleRestore = async (versionId: string) => {
    setRestoring(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка восстановления')
      }
      const data = await res.json()
      if (isEditableDocumentContent(data.document.contentJson)) {
        setContent(data.document.contentJson)
        contentRef.current = data.document.contentJson
      }
      setDocument((prev) => (prev ? { ...prev, ...data.document } : prev))
      setDirty(false)
      setShowVersions(false)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Ошибка восстановления')
    } finally {
      setRestoring(false)
    }
  }

  const hasXlsxExport =
    Boolean(document?.lastExportedAt) &&
    document?.filePath !== 'draft-placeholder.txt' &&
    (document?.fileSize ?? 0) > 0

  const hasPdfExport = Boolean(document?.pdfFilePath && (document?.pdfFileSize ?? 0) > 0)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </Layout>
    )
  }

  if (!document) {
    return (
      <Layout>
        <ErrorBanner message={loadError || 'Документ не найден'} />
      </Layout>
    )
  }

  const isLegacy = !content || !isEditableDocumentContent(document.contentJson)
  const isUpd = content && isUpdContent(content)
  const isInvoice = content && isInvoiceContent(content)
  const isKs2 = content && isKs2Content(content)
  const isKs3 = content && isKs3Content(content)
  const isServiceAct = content && isServiceActContent(content)
  const isFnsPreview = isKs2 || isKs3 || isServiceAct
  const isCommercialOffer = content && isCommercialOfferContent(content)
  const isContract = content && isContractContent(content)
  const isDocxType = isInvoice || isCommercialOffer || isContract || isServiceAct
  const sourceMeta = document.sourceMeta as DocumentSourceMeta | null | undefined
  const projectId = document.project?.id
  const updSourceMetaWarning =
    isUpd && !sourceMeta?.invoiceDocumentId
      ? 'УПД не привязан к счёту-основанию. Рекомендуется создать УПД из счёта.'
      : null

  const chainAction =
    isCommercialOffer && projectId
      ? {
          label: 'Создать счёт',
          href: `/documents/new?type=INVOICE&projectId=${projectId}&commercialOfferId=${documentId}`,
        }
      : isInvoice && projectId
        ? {
            label: 'Создать УПД',
            href: `/documents/new?type=UPD&projectId=${projectId}&invoiceDocumentId=${documentId}`,
          }
        : isKs2 && projectId
          ? {
              label: 'Создать КС-3',
              href: `/documents/new?type=KS3&projectId=${projectId}`,
            }
          : undefined

  const handleDownloadDocx = () => {
    window.open(
      `/api/documents/${documentId}/download?t=${encodeURIComponent(downloadCacheKey)}`,
      '_blank'
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <DocumentEditorHeader
          title={document.title}
          editorStatus={document.editorStatus}
          hasUnpublishedChanges={document.hasUnpublishedChanges}
          saveStatus={saveStatus}
          hasXlsxExport={hasXlsxExport}
          hasPdfExport={hasPdfExport}
          readOnly={!canEdit}
          projectId={document.project?.id}
          projectName={document.project?.name}
          onSave={() => saveContent(false)}
          onExport={isLegacy ? undefined : handleExport}
          onDownloadXlsx={handleDownloadXlsx}
          onDownloadPdf={handleDownloadPdf}
          onToggleVersions={isUpd ? undefined : handleToggleVersions}
          exporting={exporting}
          exportStatusLabel={exportStatusLabel}
          exportMode={isDocxType ? 'docx' : 'upd'}
          chainAction={chainAction}
          hasDocxExport={Boolean(isDocxType && hasXlsxExport)}
          onDownloadDocx={isDocxType ? handleDownloadDocx : undefined}
          approvalStatus={approvalStatus === 'CANCELLED' ? null : approvalStatus}
          approvalCreateHref={`/approvals?create=1&documentId=${documentId}&title=${encodeURIComponent(document.title)}`}
        />

        <div className="max-w-7xl mx-auto px-4 py-6">
          <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
          <ErrorBanner message={exportError} onDismiss={() => setExportError(null)} />

          {!isLegacy && (
            <div className="mb-6">
              <DocumentBrandingPanel
                companyId={session?.user?.companyId}
                includeStamp={includeStamp}
                includeSignature={includeSignature}
                onChange={({ includeStamp: stamp, includeSignature: signature }) => {
                  setIncludeStamp(stamp)
                  setIncludeSignature(signature)
                }}
                readOnly={!canEdit}
              />
            </div>
          )}

          {isLegacy ? (
            <LegacyDocumentNotice
              documentId={documentId}
              projectId={document.project?.id}
              fileName={document.fileName}
              category={document.category}
            />
          ) : isUpd ? (
            <UpdEditor
              content={content as UpdDocumentContent}
              onChange={handleContentChange}
              validationErrors={validationErrors}
              readOnly={!canEdit}
              sourceInvoice={sourceInvoice}
              sourceMetaWarning={updSourceMetaWarning}
            />
          ) : isInvoice ? (
            <InvoiceEditor
              content={content as InvoiceDocumentContent}
              onChange={handleContentChange}
              readOnly={!canEdit}
            />
          ) : isCommercialOffer ? (
            <CommercialOfferEditor
              content={content as CommercialOfferDocumentContent}
              onChange={handleContentChange}
              readOnly={!canEdit}
            />
          ) : isContract ? (
            <ContractEditor
              content={content as ContractDocumentContent}
              onChange={handleContentChange}
              readOnly={!canEdit}
            />
          ) : isFnsPreview && content ? (
            <FnsDraftPreview content={content} />
          ) : content ? (
            <div className="bg-white rounded-lg border p-6 text-sm text-gray-600">
              Редактор для этого типа документа пока недоступен. Используйте «Сформировать» для
              выгрузки файла.
            </div>
          ) : null}
        </div>

        {!isUpd && (
          <DocumentVersionHistory
            open={showVersions}
            onClose={() => setShowVersions(false)}
            current={
              versions?.current
                ? {
                    ...(versions.current as VersionItem),
                    createdAt:
                      (versions.current as VersionItem).createdAt?.toString?.() ||
                      String((versions.current as VersionItem).createdAt),
                  }
                : null
            }
            versions={
              (versions?.versions as VersionItem[] | undefined)?.map((v) => ({
                ...v,
                createdAt: v.createdAt?.toString?.() || String(v.createdAt),
              })) || []
            }
            documentId={documentId}
            onRestore={handleRestore}
            restoring={restoring}
          />
        )}
      </div>
    </Layout>
  )
}

interface VersionItem {
  id?: string
  version: number
  fileName: string
  fileSize: number
  createdAt: string
  comment?: string | null
  isCurrent?: boolean
}
