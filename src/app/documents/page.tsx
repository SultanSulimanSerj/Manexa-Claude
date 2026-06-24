'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageSuspense } from '@/components/page-suspense'
import Layout from '@/components/layout'
import PageHeader from '@/components/page-header'
import { SkeletonList } from '@/components/ui/skeleton'
import { usePagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { confirm } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Search, Download, Trash2, Pencil, X, Upload, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { CreateDocumentMenu } from '@/components/documents/CreateDocumentMenu'
import { EDITABLE_CATEGORIES } from '@/lib/document-category-labels'

interface Document {
  id: string
  title: string
  description: string | null
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  version: number
  category: string | null
  editorStatus: string | null
  hasEditableContent?: boolean
  hasUnpublishedChanges?: boolean
  pdfFilePath?: string | null
  pdfFileSize?: number | null
  lastExportedAt: string | null
  createdAt: string
  projectId: string | null
  project: { id: string; name: string } | null
  creator: { id: string; name: string; email: string }
}

function DocumentsPageContent() {
  const searchParams = useSearchParams()
  const projectIdFromUrl = searchParams?.get('projectId')
  
  const [documents, setDocuments] = useState<Document[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(projectIdFromUrl || 'all')
  const [showModal, setShowModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: projectIdFromUrl || ''
  })

  useEffect(() => {
    fetchDocuments()
    fetchProjects()
    if (projectIdFromUrl) {
      fetchCurrentProject()
      setProjectFilter(projectIdFromUrl)
    }
  }, [projectIdFromUrl])

  const fetchCurrentProject = async () => {
    if (!projectIdFromUrl) return
    try {
      const response = await fetch(`/api/projects/${projectIdFromUrl}`, {
      })
      if (response.ok) {
        const data = await response.json()
        setCurrentProject(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchDocuments = async () => {
    try {
      setLoadError(null)
      const response = await fetch('/api/documents', {
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      } else {
        const data = await response.json().catch(() => ({}))
        setLoadError(data.error || 'Не удалось загрузить документы')
      }
    } catch {
      setLoadError('Ошибка при загрузке документов')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
      })
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', uploadFile)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      if (formData.projectId) {
        formDataToSend.append('projectId', formData.projectId)
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
        },
        body: formDataToSend
      })

      if (response.ok) {
        setShowModal(false)
        setUploadFile(null)
        setFormData({ title: '', description: '', projectId: '' })
        fetchDocuments()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/documents/${documentId}/download`)
      if (response.ok) {
        window.open(`/api/documents/${documentId}/download`, '_blank')
      } else {
        setErrorMessage('Ошибка при скачивании файла')
      }
    } catch (error) {
      console.error('Download error:', error)
      setErrorMessage('Ошибка при скачивании файла')
    }
  }

  const handleDeleteClick = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить документ?',
      description: 'Документ будет удалён без возможности восстановления.',
      confirmText: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchDocuments()
      } else {
        const raw = await response.text()
        let data: { error?: string } = {}
        try {
          data = raw ? JSON.parse(raw) : {}
        } catch {
          setErrorMessage(`Ошибка сервера (${response.status})`)
          return
        }
        setErrorMessage(data.error || 'Ошибка при удалении документа')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Ошибка при удалении документа')
    }
  }


  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getDownloadTitle = (doc: Document) => {
    if (doc.category === 'UPD') return 'Скачать Excel'
    if (
      doc.mimeType?.includes('word') ||
      doc.fileName?.toLowerCase().endsWith('.docx')
    ) {
      return 'Скачать Word'
    }
    return 'Скачать файл'
  }

  const getFileType = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('image')) return 'IMG'
    if (mimeType.includes('word')) return 'DOC'
    if (mimeType.includes('excel')) return 'XLS'
    return 'FILE'
  }

  const getFileColor = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'bg-red-50 text-red-700 border-red-200'
    if (mimeType.includes('image')) return 'bg-purple-50 text-purple-700 border-purple-200'
    if (mimeType.includes('word')) return 'bg-blue-50 text-blue-700 border-blue-200'
    if (mimeType.includes('excel')) return 'bg-green-50 text-green-700 border-green-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const isEditableDocument = (doc: Document) => EDITABLE_CATEGORIES.has(doc.category || '')

  const editorHref = (doc: Document) =>
    isEditableDocument(doc) ? `/documents/${doc.id}/edit` : null

  /** Файл ещё не сформирован (только черновик в редакторе). */
  const isUnformedFile = (doc: Document) =>
    isEditableDocument(doc) &&
    !doc.lastExportedAt &&
    (doc.fileSize === 0 || doc.fileName === 'draft-placeholder.txt')

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProject = projectFilter === 'all' || !projectFilter || doc.project?.id === projectFilter
    return matchesSearch && matchesProject
  })

  const { pageItems: pagedDocuments, Pagination } = usePagination(filteredDocuments, 20)

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Документы" description="Загрузка..." />
          <SkeletonList rows={6} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />
      {/* Ошибка */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
          <span className="shrink-0">⚠️</span>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-600 hover:underline shrink-0">Скрыть</button>
        </div>
      )}

      <div className="space-y-6">
        <PageHeader
          title={currentProject ? `Документы проекта "${currentProject.name}"` : 'Документы'}
          description={`${filteredDocuments.length} документов`}
          back={currentProject ? `/projects/${currentProject.id}` : undefined}
          breadcrumbs={
            currentProject
              ? [
                  { label: 'Проекты', href: '/projects' },
                  { label: currentProject.name, href: `/projects/${currentProject.id}` },
                  { label: 'Документы' },
                ]
              : undefined
          }
          actions={
            <>
              <CreateDocumentMenu projectId={projectIdFromUrl || undefined} />
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Загрузить
              </button>
            </>
          }
        />

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск документов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Все проекты</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {filteredDocuments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length === 0 ? 'Пока нет документов' : 'Ничего не найдено'}
            description={
              documents.length === 0
                ? 'Загрузите файл или создайте документ, чтобы начать.'
                : 'Попробуйте изменить поиск или фильтры.'
            }
            action={
              documents.length === 0 ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Загрузить
                </button>
              ) : undefined
            }
          />
        ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Документ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Файл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Размер</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проект</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getFileColor(doc.mimeType)}`}>
                        {getFileType(doc.mimeType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {editorHref(doc) ? (
                          <Link
                            href={editorHref(doc)!}
                            className="text-sm font-semibold text-gray-900 visited:text-gray-900 hover:underline"
                          >
                            {doc.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{doc.title}</span>
                        )}
                        {doc.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isUnformedFile(doc) ? (
                        editorHref(doc) ? (
                          <Link
                            href={editorHref(doc)!}
                            className="text-sm text-gray-700 visited:text-gray-700 hover:underline"
                          >
                            Черновик
                          </Link>
                        ) : (
                          <span className="text-sm text-amber-700">Черновик</span>
                        )
                      ) : editorHref(doc) ? (
                        <Link
                          href={editorHref(doc)!}
                          className="text-sm text-gray-700 visited:text-gray-700 hover:underline"
                        >
                          {doc.fileName}
                        </Link>
                      ) : (
                        <div className="text-sm text-gray-700">{doc.fileName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatFileSize(doc.fileSize)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {doc.project ? (
                        <Link 
                          href={`/projects/${doc.project.id}`}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          {doc.project.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">
                        {new Date(doc.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditableDocument(doc) && (
                          <Link
                            href={`/documents/${doc.id}/edit`}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        )}
                        <button 
                          onClick={() => handleDownload(doc.id, doc.fileName)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-40" 
                          title={getDownloadTitle(doc)}
                          disabled={doc.fileSize === 0 && !doc.lastExportedAt}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {doc.pdfFilePath && (doc.pdfFileSize ?? 0) > 0 && (
                          <a
                            href={`/api/documents/${doc.id}/download?format=pdf`}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs font-medium"
                            title="Скачать PDF"
                          >
                            PDF
                          </a>
                        )}
                        <button 
                          onClick={() => handleDeleteClick(doc.id)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" 
                          title="Удалить"
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

        {/* Modal */}
        <Dialog
          open={showModal}
          onOpenChange={(o) => {
            if (!o) {
              setShowModal(false)
              setUploadFile(null)
            }
          }}
        >
          <DialogContent className="max-w-2xl p-0">
            <DialogHeader className="border-b p-6 pb-4">
              <DialogTitle>Загрузить документ</DialogTitle>
            </DialogHeader>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Файл *</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-purple-400 transition-colors">
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-sm"
                      required
                    />
                    {uploadFile && (
                      <p className="text-xs text-gray-600 mt-2">
                        Выбран: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Проект</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Без проекта</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Загрузить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setUploadFile(null)
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                </div>
              </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}

export default function DocumentsPage() {
  return (
    <PageSuspense>
      <DocumentsPageContent />
    </PageSuspense>
  )
}