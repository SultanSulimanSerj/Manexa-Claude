import type { TemplateDocCategory } from './template-tags'

export interface TemplateDocTypeGuide {
  id: TemplateDocCategory | 'UPD'
  label: string
  description: string
  supportsCustomTemplate: boolean
  fileFormat: 'DOCX' | 'XLSX'
  baseDownloadUrl?: string
  baseDownloadLabel?: string
}

export const TEMPLATE_DOC_TYPES: TemplateDocTypeGuide[] = [
  {
    id: 'CONTRACT',
    label: 'Договор',
    description: 'Договор подряда или оказания услуг с приложением-спецификацией.',
    supportsCustomTemplate: true,
    fileFormat: 'DOCX',
    baseDownloadUrl: '/api/templates/base/contract',
    baseDownloadLabel: 'Скачать базовый шаблон договора',
  },
  {
    id: 'COMMERCIAL_OFFER',
    label: 'Коммерческое предложение',
    description: 'КП с перечнем работ и итоговой суммой.',
    supportsCustomTemplate: true,
    fileFormat: 'DOCX',
    baseDownloadUrl: '/api/templates/base/commercial-offer',
    baseDownloadLabel: 'Скачать базовый шаблон КП',
  },
  {
    id: 'INVOICE',
    label: 'Счёт на оплату',
    description: 'Исходящий счёт с банковскими реквизитами и таблицей позиций.',
    supportsCustomTemplate: true,
    fileFormat: 'DOCX',
    baseDownloadUrl: '/api/templates/base/invoice',
    baseDownloadLabel: 'Скачать базовый шаблон счёта',
  },
  {
    id: 'UPD',
    label: 'УПД (акт)',
    description:
      'Универсальный передаточный документ формируется по встроенной Excel-форме. Загрузка собственного шаблона пока не поддерживается — данные подставляются автоматически из счёта и договора.',
    supportsCustomTemplate: false,
    fileFormat: 'XLSX',
  },
]

export const TEMPLATE_PREP_STEPS = [
  {
    title: 'Скачайте образец',
    text: 'Возьмите базовый шаблон Manexa или свой документ Word (.docx).',
  },
  {
    title: 'Расставьте теги в Word',
    text: 'Скопируйте тег из справочника и вставьте вместо нужного текста. Синтаксис: {имяТега}, для списка позиций — {#items}...{/items}.',
  },
  {
    title: 'Загрузите шаблон',
    text: 'Раздел «Шаблоны» → «Новый шаблон». Выберите категорию (договор, КП или счёт) и загрузите файл.',
  },
  {
    title: 'Сделайте базовым',
    text: 'Отметьте «Использовать по умолчанию» при загрузке или нажмите «Сделать базовым» на странице шаблона. Тогда он будет применяться ко всем новым документам этой категории.',
  },
  {
    title: 'Создавайте документы',
    text: 'При создании договора, КП или счёта в проекте система автоматически подставит ваш шаблон и заполнит теги данными из сметы, компании и клиента.',
  },
]

export const DOCX_TAG_RULES = [
  'Теги пишутся в фигурных скобках: {contractNumber}, {clientLegalName}.',
  'Для таблицы позиций оставьте одну строку-пример и оберните её в {#items} и {/items}.',
  'Внутри цикла используйте {lineNumber}, {name}, {quantity}, {unit}, {unitPrice}, {total}.',
  'Не разбивайте тег на несколько фрагментов в Word — иначе docxtemplater не найдёт его.',
  'Пустые поля подставятся как пустая строка.',
]
