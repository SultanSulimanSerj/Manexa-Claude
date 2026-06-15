export type TemplateDocCategory = 'CONTRACT' | 'COMMERCIAL_OFFER' | 'INVOICE'

export type TemplateTagCategory =
  | TemplateDocCategory
  | 'company'
  | 'client'
  | 'document'
  | 'project'
  | 'items'
  | 'invoice'
  | 'bank'

export interface TemplateTagDefinition {
  tag: string
  label: string
  description: string
  category: TemplateTagCategory
  forCategories: TemplateDocCategory[]
  isLoop?: boolean
}

export const TEMPLATE_TAG_GROUPS: Array<{
  id: TemplateTagCategory
  title: string
  forCategories: TemplateDocCategory[]
}> = [
  { id: 'company', title: 'Компания (исполнитель)', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { id: 'client', title: 'Клиент (заказчик)', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { id: 'document', title: 'Документ', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { id: 'project', title: 'Проект', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { id: 'items', title: 'Позиции сметы', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { id: 'document', title: 'Счёт', forCategories: ['INVOICE'] },
  { id: 'company', title: 'Продавец', forCategories: ['INVOICE'] },
  { id: 'bank', title: 'Банковские реквизиты', forCategories: ['INVOICE'] },
  { id: 'client', title: 'Покупатель', forCategories: ['INVOICE'] },
  { id: 'items', title: 'Позиции счёта', forCategories: ['INVOICE'] },
]

export const TEMPLATE_TAGS: TemplateTagDefinition[] = [
  { tag: 'executorLegalName', label: 'Наименование компании', description: 'Полное юридическое название исполнителя', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorName', label: 'Краткое название', description: 'Краткое название компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorDirector', label: 'ФИО директора', description: 'ФИО генерального директора', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorDirectorPosition', label: 'Должность директора', description: 'Например: Генеральный директор', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorInn', label: 'ИНН', description: 'ИНН компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorKpp', label: 'КПП', description: 'КПП компании-исполнителя', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorOgrn', label: 'ОГРН', description: 'ОГРН компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorAddress', label: 'Адрес', description: 'Юридический адрес компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorPhone', label: 'Телефон', description: 'Телефон компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorEmail', label: 'Email', description: 'Email компании', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorBankAccount', label: 'Расчётный счёт', description: 'Номер расчётного счёта', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorBankName', label: 'Банк', description: 'Наименование банка', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorBankBik', label: 'БИК', description: 'БИК банка', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'executorCorrespondentAccount', label: 'Корр. счёт', description: 'Корреспондентский счёт банка исполнителя', category: 'company', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientLegalName', label: 'Наименование клиента', description: 'Полное название заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientName', label: 'Краткое название клиента', description: 'Краткое название заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientDirector', label: 'ФИО представителя клиента', description: 'ФИО директора или представителя заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientInn', label: 'ИНН клиента', description: 'ИНН заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientKpp', label: 'КПП клиента', description: 'КПП заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientOgrn', label: 'ОГРН клиента', description: 'ОГРН заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientAddress', label: 'Адрес клиента', description: 'Юридический адрес заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientPhone', label: 'Телефон клиента', description: 'Контактный телефон заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientEmail', label: 'Email клиента', description: 'Email заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientBankAccount', label: 'Расчётный счёт клиента', description: 'Номер расчётного счёта заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientBankName', label: 'Банк клиента', description: 'Наименование банка заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientBankBik', label: 'БИК банка клиента', description: 'БИК банка заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'clientCorrespondentAccount', label: 'Корр. счёт клиента', description: 'Корреспондентский счёт банка заказчика', category: 'client', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'contractNumber', label: 'Номер документа', description: 'Номер договора или КП', category: 'document', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'contractDate', label: 'Дата документа', description: 'Дата договора или КП', category: 'document', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'city', label: 'Город', description: 'Город заключения договора', category: 'document', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'projectName', label: 'Название проекта', description: 'Наименование проекта', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'workAddress', label: 'Адрес объекта', description: 'Адрес выполнения работ', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'startDate', label: 'Дата начала', description: 'Дата начала работ', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'endDate', label: 'Дата окончания', description: 'Дата окончания работ', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'totalAmount', label: 'Сумма', description: 'Итоговая сумма по смете', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'totalAmountWords', label: 'Сумма прописью', description: 'Итоговая сумма прописью', category: 'project', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER'] },
  { tag: 'subject', label: 'Предмет договора', description: 'Краткое описание предмета', category: 'project', forCategories: ['CONTRACT'] },
  { tag: 'validUntil', label: 'Срок действия КП', description: 'Дата окончания действия предложения', category: 'document', forCategories: ['COMMERCIAL_OFFER'] },
  { tag: '#items', label: 'Начало списка позиций', description: 'Открывающий тег цикла по позициям сметы', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'], isLoop: true },
  { tag: '/items', label: 'Конец списка позиций', description: 'Закрывающий тег цикла', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'], isLoop: true },
  { tag: 'lineNumber', label: '№ п/п', description: 'Номер строки (внутри цикла items)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'name', label: 'Наименование', description: 'Наименование позиции (внутри цикла)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'quantity', label: 'Количество', description: 'Количество (внутри цикла)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'unit', label: 'Ед. изм.', description: 'Единица измерения (внутри цикла)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'unitPrice', label: 'Цена', description: 'Цена за единицу (внутри цикла)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'total', label: 'Сумма позиции', description: 'Сумма по позиции (внутри цикла)', category: 'items', forCategories: ['CONTRACT', 'COMMERCIAL_OFFER', 'INVOICE'] },
  { tag: 'documentNumber', label: 'Номер счёта', description: 'Номер счёта на оплату', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'documentDate', label: 'Дата счёта', description: 'Дата выставления счёта', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'sellerAddressLine', label: 'Продавец с адресом', description: 'Наименование и адрес продавца одной строкой', category: 'company', forCategories: ['INVOICE'] },
  { tag: 'sellerLegalName', label: 'Наименование продавца', description: 'Полное юридическое название', category: 'company', forCategories: ['INVOICE'] },
  { tag: 'sellerInn', label: 'ИНН продавца', description: 'ИНН компании-продавца', category: 'company', forCategories: ['INVOICE'] },
  { tag: 'sellerKpp', label: 'КПП продавца', description: 'КПП компании-продавца', category: 'company', forCategories: ['INVOICE'] },
  { tag: 'directorShortName', label: 'Подпись директора', description: 'Фамилия и инициалы директора, напр. Иванов И.И.', category: 'company', forCategories: ['INVOICE'] },
  { tag: 'bankName', label: 'Банк', description: 'Наименование банка', category: 'bank', forCategories: ['INVOICE'] },
  { tag: 'bankBik', label: 'БИК', description: 'БИК банка', category: 'bank', forCategories: ['INVOICE'] },
  { tag: 'bankCity', label: 'Город банка', description: 'Город отделения банка', category: 'bank', forCategories: ['INVOICE'] },
  { tag: 'correspondentAccount', label: 'Корр. счёт', description: 'Корреспондентский счёт банка', category: 'bank', forCategories: ['INVOICE'] },
  { tag: 'bankAccount', label: 'Расчётный счёт', description: 'Расчётный счёт компании', category: 'bank', forCategories: ['INVOICE'] },
  { tag: 'buyerLine', label: 'Покупатель', description: 'Наименование, ИНН, КПП и адрес покупателя', category: 'client', forCategories: ['INVOICE'] },
  { tag: 'totalFormatted', label: 'Итого', description: 'Итоговая сумма с копейками', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'vatLabel', label: 'Подпись НДС', description: '«НДС» или «Без налога (НДС)»', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'vatDisplay', label: 'Сумма НДС', description: 'Сумма НДС или «-»', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'itemsSummary', label: 'Итого наименований', description: 'Строка «Всего наименований N на сумму…»', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'totalInWords', label: 'Сумма прописью', description: 'Итоговая сумма прописью', category: 'document', forCategories: ['INVOICE'] },
  { tag: 'paymentTerms', label: 'Условия оплаты', description: 'Назначение платежа и срок оплаты', category: 'document', forCategories: ['INVOICE'] },
]

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateDocCategory, string> = {
  CONTRACT: 'Договор',
  COMMERCIAL_OFFER: 'Коммерческое предложение',
  INVOICE: 'Счёт на оплату',
}

export const VALID_TEMPLATE_CATEGORIES: TemplateDocCategory[] = [
  'CONTRACT',
  'COMMERCIAL_OFFER',
  'INVOICE',
]

export function isTemplateDocCategory(value: string): value is TemplateDocCategory {
  return VALID_TEMPLATE_CATEGORIES.includes(value as TemplateDocCategory)
}

export function formatTagForDocx(tag: string): string {
  return `{${tag}}`
}

export function getTagsForCategory(category: TemplateDocCategory): TemplateTagDefinition[] {
  return TEMPLATE_TAGS.filter((t) => t.forCategories.includes(category))
}

export function getTagGroupsForCategory(category: TemplateDocCategory) {
  const tags = getTagsForCategory(category)
  const groupIds = new Set(tags.map((t) => t.category))
  return TEMPLATE_TAG_GROUPS.filter(
    (g) => g.forCategories.includes(category) && groupIds.has(g.id)
  ).map((g) => ({
    ...g,
    tags: tags.filter((t) => t.category === g.id),
  }))
}

export function getKnownTagNames(): Set<string> {
  return new Set(TEMPLATE_TAGS.map((t) => t.tag).filter((t) => !t.startsWith('#') && !t.startsWith('/')))
}

export function getTagLabel(tagName: string): string {
  const def = TEMPLATE_TAGS.find((t) => t.tag === tagName)
  return def?.label || tagName
}
