'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'

export type DocumentApprovalStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const APPROVAL_STATUS_LABELS: Record<DocumentApprovalStatus, { label: string; className: string }> = {
  PENDING: { label: 'На согласовании', className: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'На согласовании', className: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'Согласован', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Отклонён', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Согласование отменено', className: 'bg-gray-100 text-gray-600' },
}

interface DocumentEditorHeaderProps {
  title: string
  editorStatus: string
  hasUnpublishedChanges?: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  hasXlsxExport: boolean
  hasPdfExport: boolean
  readOnly?: boolean
  projectId?: string | null
  projectName?: string | null
  onSave: () => void
  onExport?: (format: 'both' | 'xlsx' | 'pdf') => void
  onDownloadXlsx: () => void
  onDownloadPdf: () => void
  onToggleVersions?: () => void
  exporting?: boolean
  exportStatusLabel?: string | null
  exportMode?: 'upd' | 'docx'
  chainAction?: { label: string; href: string }
  hasDocxExport?: boolean
  onDownloadDocx?: () => void
  /** Доступны ли печать/подпись компании (показывать тумблер) */
  brandingAvailable?: boolean
  /** Включены ли печать+подпись при выгрузке */
  brandingOn?: boolean
  onBrandingToggle?: (value: boolean) => void
  /** Статус активного согласования документа (если есть) */
  approvalStatus?: DocumentApprovalStatus | null
  /** Ссылка на создание согласования для документа */
  approvalCreateHref?: string
}

export function DocumentEditorHeader({
  title,
  editorStatus,
  hasUnpublishedChanges,
  saveStatus,
  hasXlsxExport,
  hasPdfExport,
  readOnly,
  projectId,
  projectName,
  onSave,
  onExport,
  onDownloadXlsx,
  onDownloadPdf,
  onToggleVersions,
  exporting,
  exportStatusLabel,
  exportMode = 'upd',
  chainAction,
  hasDocxExport,
  onDownloadDocx,
  brandingAvailable,
  brandingOn,
  onBrandingToggle,
  approvalStatus,
  approvalCreateHref,
}: DocumentEditorHeaderProps) {
  const approvalBadge = approvalStatus ? APPROVAL_STATUS_LABELS[approvalStatus] : null
  const statusLabel =
    editorStatus === 'PUBLISHED' && hasUnpublishedChanges
      ? 'Есть правки'
      : editorStatus === 'PUBLISHED'
        ? 'Опубликован'
        : editorStatus === 'ARCHIVED'
          ? 'В архиве'
          : 'Черновик'

  const statusColor =
    editorStatus === 'PUBLISHED' && hasUnpublishedChanges
      ? 'bg-orange-100 text-orange-800'
      : editorStatus === 'PUBLISHED'
        ? 'bg-green-100 text-green-800'
        : editorStatus === 'ARCHIVED'
          ? 'bg-gray-100 text-gray-600'
          : 'bg-amber-100 text-amber-800'

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          {projectId ? (
            <Link
              href={`/documents?projectId=${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {projectName ? `Документы «${projectName}»` : 'Документы'}
            </Link>
          ) : (
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Документы
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
            <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded ${statusColor}`}>
              {statusLabel}
            </span>
            {readOnly && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Только просмотр
              </span>
            )}
            {!readOnly && saveStatus === 'saving' && (
              <span className="text-xs text-gray-500">Сохранение…</span>
            )}
            {!readOnly && saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                Сохранено
              </span>
            )}
            {!readOnly && saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                Ошибка сохранения
              </span>
            )}
            {exporting && exportStatusLabel && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {exportStatusLabel}
              </span>
            )}
            {approvalBadge && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${approvalBadge.className}`}
              >
                <ShieldCheck className="h-3 w-3" />
                {approvalBadge.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!approvalBadge && approvalCreateHref && (
              <Link
                href={approvalCreateHref}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
              >
                <ShieldCheck className="h-4 w-4" />
                На согласование
              </Link>
            )}
            {chainAction && (
              <Link
                href={chainAction.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50"
              >
                {chainAction.label}
              </Link>
            )}
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={onSave}
                  className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  Сохранить
                </button>
                {onExport && (
                  <>
                    <button
                      type="button"
                      onClick={() => onExport('pdf')}
                      disabled={exporting}
                      className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent active:scale-[0.98] disabled:opacity-50"
                    >
                      {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport('xlsx')}
                      disabled={exporting}
                      className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent active:scale-[0.98] disabled:opacity-50"
                    >
                      {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {exportMode === 'docx' ? 'Word' : 'Excel'}
                    </button>
                  </>
                )}
                {brandingAvailable && onBrandingToggle && (
                  <div className="ml-1 inline-flex items-center gap-2 rounded-full border border-input px-3 py-1 shadow-xs">
                    <Switch
                      checked={Boolean(brandingOn)}
                      onCheckedChange={onBrandingToggle}
                      disabled={exporting}
                      aria-label="Подпись и печать при выгрузке"
                    />
                    <span className="text-sm font-medium text-foreground">Подпись и печать</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
