import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import { getRemainingContractSections } from './contract-remaining-sections'
import { buildSpecificationAppendix, type SpecificationData } from './specification-appendix'

export interface ContractData {
  contractNumber: string
  contractDate: string
  city: string
  
  // Исполнитель (наша компания)
  executorName: string
  executorLegalName: string
  executorDirector: string
  executorDirectorPosition: string
  executorInn: string
  executorKpp: string
  executorOgrn: string
  executorAddress: string
  executorPhone: string
  executorEmail: string
  executorBankAccount: string
  executorBankName: string
  executorBankBik: string
  executorCorrespondentAccount: string
  
  // Заказчик (клиент)
  clientName: string
  clientLegalName: string
  clientDirector: string
  clientInn: string
  clientKpp: string
  clientOgrn: string
  clientLegalAddress: string
  clientPhone: string
  clientEmail: string
  clientBankAccount: string
  clientBankName: string
  clientBankBik: string
  clientCorrespondentAccount: string
  
  // Данные проекта
  projectName: string
  projectDescription: string
  workAddress: string
  startDate: string
  endDate: string
  totalAmount: string
  vatEnabled: boolean
  specification?: SpecificationData
}

export function generateContractDocument(data: ContractData): Document {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Заголовок договора
        new Paragraph({
          text: `ДОГОВОР № ${data.contractNumber}`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        
        // Город и дата
        new Paragraph({
          children: [
            new TextRun({
              text: `г. ${data.city}`,
              bold: false
            }),
            new TextRun({
              text: '\t\t\t\t\t\t\t\t\t\t',
            }),
            new TextRun({
              text: `"${data.contractDate}"`,
            })
          ],
          spacing: { after: 400 }
        }),
        
        // Преамбула
        new Paragraph({
          text: `${data.clientLegalName || data.clientName}, в лице ${data.clientDirector || 'Генерального директора'}, действующего на основании Устава, именуемое в дальнейшем «Заказчик» и ${data.executorLegalName || data.executorName}, в лице ${data.executorDirector || 'Генерального директора'}, действующего на основании Устава, именуемое в дальнейшем «Исполнитель», с другой стороны, именуемые в дальнейшем «Стороны», заключили настоящий Договор (далее-Договор) о нижеследующем.`,
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // 1. Предмет договора
        new Paragraph({
          text: '1. Предмет договора',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: `1.1. Исполнитель обязуется выполнить комплекс строительно-монтажных и ремонтных работ по адресу: ${data.workAddress || 'указан в спецификации'}, согласно спецификациям к Договору, являющимся неотъемлемой его частью (далее-Спецификация), а Заказчик принять работы и оплатить выполненные Исполнителем Работы.`,
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: data.startDate || data.endDate
            ? `1.2. Срок выполнения работ: ${data.startDate || '—'} — ${data.endDate || '—'}. Место выполнения Работ: ${data.workAddress || 'указано в Спецификации'}.`
            : '1.2. Срок выполнения и место выполнения Работ указаны в соответствующей Спецификации к Договору.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '1.3. Исключительные авторские права на схему коммутации оборудования и проводки кабеля принадлежат Исполнителю. Заказчик имеет право использовать схему коммутации и дополнительную консультационную информацию лишь в целях, определяемых настоящим Договором.',
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // 2. Стоимость и порядок расчетов
        new Paragraph({
          text: '2. Стоимость и порядок расчетов',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: data.vatEnabled 
            ? '2.1. Цена Договора складывается из стоимости всех Спецификаций, заключенных Сторонами в период действия Договора, включая НДС.'
            : '2.1. Цена Договора складывается из стоимости всех Спецификаций, заключенных Сторонами в период действия Договора, НДС не облагается согласно п. 3 ст. 346.11 гл. 26.2 НК РФ.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),

        ...(data.totalAmount
          ? [
              new Paragraph({
                text: `2.2. Стоимость работ по Спецификации № 1 составляет ${data.totalAmount} ₽${data.vatEnabled ? ', включая НДС' : ''}.`,
                spacing: { after: 200 },
                alignment: AlignmentType.JUSTIFIED,
              }),
            ]
          : []),
        
        new Paragraph({
          text: '2.3. Заказчик производит авансовый платеж в размере 50% от стоимости Работ, указанной в соответствующей Спецификации, в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, путем перечисления денежных средств на расчетный счет Исполнителя.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: 'Заказчик производит окончательную оплату в размере 50% от стоимости Работ, указанной в соответствующей Спецификации, в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, выставленного после подписания актов по форме КС-2, КС-3.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: 'Заказчик производит платеж в размере 100% от стоимости материалов, указанной в соответствующей Спецификации, в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, путем перечисления денежных средств на расчетный счет Исполнителя.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: 'Оплата по Договору производится в Российских рублях. Днем оплаты считается день списания денежных средств с корреспондентского счета банка Заказчика.',
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // 3. Обязанности сторон
        new Paragraph({
          text: '3. Обязанности сторон',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: '3.1 Исполнитель обязуется:',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.1. На основании предоставленных Заказчиком планов (схем) помещений, фасада, кровли здания, схемы проводки слаботочных и силовых линий связи и/или предварительно проведенной работы по обследованию объекта Заказчика (услуга оплачивается отдельно), в соответствии с его пожеланиями, составить предварительный расчет по поставке, монтажу и настройке оборудования.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.2. Передать Заказчику оборудование пригодное к эксплуатации в порядке и в сроки, предусмотренные настоящим Договором. Исполнитель гарантирует, что оборудование передается новым, не бывшим в употреблении, под арестом и залогом не состоит.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.3. Производить Работы надлежащего качества в сроки, предусмотренные соответствующей Спецификации.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.4. Предоставлять Заказчику по его запросу необходимую информацию о порядке и ходе выполнения Работ.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.5. Информировать Заказчика об обстоятельствах, влияющих на срок исполнения обязательств по Договору.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.1.6. Выполнять надлежащим образом иные обязанности, предусмотренные Договором и законодательством Российской Федерации.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2 Заказчик обязуется:',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.1. Принять и оплатить оборудование и Работы согласно п. 2 настоящего Договора.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.2. Оказывать содействие Исполнителю в случаях, в объеме и порядке предусмотренных Договором и приложениями к нему.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.3. Предоставить Исполнителю свободный доступ во все технические, жилые и нежилые помещения, необходимые для выполнения Работ и всячески способствовать их выполнению в кратчайшие сроки.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.4. В день доставки оборудования и проведения Работ предоставить место для складирования за свой счет в приспособленном для этих целей охраняемом помещении, до и во время монтажных Работ.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.5. Подготовить помещения для проведения монтажных Работ.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.6. На время выполнения Работ обеспечить электроснабжением, позволяющим вести работу электроинструментом мощностью 1500 Ватт.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '3.2.7. Незамедлительно информировать Исполнителя о возможных дефектах установленного оборудования, возникших в течение эксплуатации гарантийного срока.',
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // 4. Порядок поставки и приемки оборудования
        new Paragraph({
          text: '4. Порядок поставки и приемки оборудования',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: '4.1 Оборудование передается доверенному представителю Заказчика по адресу, согласованному Сторонам в Спецификации.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.2 Заказчик обязан совершить все необходимые действия, обеспечивающие приемку оборудования, а именно:',
          spacing: { after: 100 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '• осуществить осмотр передаваемого оборудования в месте его передачи;',
          spacing: { after: 50 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '• проверить упаковку оборудования;',
          spacing: { after: 50 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '• проверить количество и комплектность оборудования, указанного в товаросопроводительной документации на соответствие Спецификации поставляемого оборудования.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.3 Заказчик принимает оборудование в день приемки при условии, что: количество и комплектность оборудования, указанного в товаросопроводительной документации, соответствуют Спецификации поставляемого оборудования; упаковка оборудования не имеет видимых повреждений; оборудование имеет все необходимые сертификаты, полностью укомплектовано и исправно, либо составляет Акт о несоответствии оборудования, в соответствии с п. 4.4. Договора.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.4 В случае обнаружения при приемке некомплектности, количественной недопоставки, дефектов упаковки оборудования, Заказчик составляет Акт о несоответствии оборудования (далее – «Акт»), в котором фиксируются обнаруженные несоответствия. Акт должен быть составлен в день получения оборудования при участии представителя Исполнителя, подписан всеми лицами, участвовавшими в приемке оборудования и предъявлен Исполнителю в течение 5 (пяти) рабочих дней с даты поставки.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.5 Подписание доверенным представителем Заказчика Товарной накладной (УПД) без составления Акта подтверждает отсутствие у Заказчика претензий по количеству, комплектности, упаковке принятого оборудования.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.7 Заказчик уведомляет Исполнителя в течение 30 (тридцати) рабочих дней с момента подписания товарной накладной (УПД) о факте выхода оборудования из строя либо об обнаружении скрытых недостатков, которые не могли быть выявлены при его осмотре в момент передачи и подписания Заказчиком товарной накладной (УПД).',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.8 Если в Спецификации не определено иное, Исполнитель обязуется в течение 10 (десяти) рабочих дней со дня получения Акта, указанного в п. 4.4. Договора, согласовать с Заказчиком сроки устранения выявленных несоответствий оборудования, либо в указанный срок письменно сообщить о своем несогласии с Актом Заказчика.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.9 Риски случайной гибели и/или порчи оборудования переходят к Заказчику с даты поставки оборудования.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '4.10 Право собственности на оборудование переходит от Исполнителя к Заказчику с даты подписания Сторонами Товарной накладной (УПД) либо актов по форме КС-2, КС-3.',
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // 5. Порядок выполнения работ и их приемки
        new Paragraph({
          text: '5. Порядок выполнения работ и их приемки',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: '5.1. Предусмотренные Договором Работы выполняются Исполнителем в соответствии с согласованными Сторонами Спецификациями на выполнение Работ.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.2. Заказчик обязуется предоставлять Исполнителю необходимые исходные данные для надлежащего выполнения Работ (в соответствии с Приложением к Договору и/или по письменному запросу Исполнителя) в течение 5 (пяти) рабочих дней с даты подписания Договора или соответствующего запроса Исполнителя.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.3. Заказчик обязуется в ходе выполнения Исполнителем Работ по Договору, согласовывать полученные от него документы, в течение 5 (пяти) рабочих дней с момента их получения. Срок согласования документов не учитывается как срок исполнения Договора. В случае уклонения Заказчика от согласования документов, Исполнитель вправе на этот период приостановить исполнение своих обязательств по Договору.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.4. В течение 5 (пяти) рабочих дней после завершения выполнения Работ Исполнитель направляет Заказчику Акт сдачи-приемки выполненных работ по форме КС-2, КС-3 и при необходимости иные отчетные документы в соответствии с условиями, предусмотренными соответствующими Спецификациями к Договору.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.5. В течение 5 (пяти) рабочих дней со дня получения документов и Акта сдачи-приемки выполненных работ по форме КС-2, КС-3 или УПД, Заказчик рассматривает их, и при отсутствии замечаний подписывает и направляет Исполнителю или в этот же срок заявляет мотивированный отказ от приемки.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.6. В случае уклонения или немотивированного отказа Заказчика от подписания Акта сдачи-приемки выполненных работ по форме КС-2, КС-3 или УПД, Работы по Договору считаются выполненными без недостатков и принятыми Заказчиком, а Акт сдачи-приемки выполненных работ или УПД считается подписанным и подлежит оплате согласно условиям Договора.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.7. В случае мотивированного отказа Заказчика от приемки выполненных Работ, Исполнитель обязуется в течение 10 (десяти) рабочих дней со дня получения мотивированного отказа, либо устранить замечания, либо согласовать с Заказчиком сроки их устранения, либо в указанный срок письменно сообщить о своем несогласии с замечаниями Заказчика. После устранения возникших разногласий Сторонами подписывается Акт сдачи-приемки выполненных работ по форме КС-2, КС-3 или УПД, в порядке, предусмотренном в настоящем разделе Договора.',
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        new Paragraph({
          text: '5.8. При необходимости выполнения дополнительного объема Работ, Стороны оформляют дополнительное соглашение к Договору, в котором указывают наименование дополнительных Работ, их содержание, срок их выполнения, стоимость и порядок оплаты.',
          spacing: { after: 400 },
          alignment: AlignmentType.JUSTIFIED
        }),
        
        // Разделы 6-13
        ...getRemainingContractSections(),

        // Приложение — Спецификация (смета)
        ...(data.specification ? buildSpecificationAppendix(data.specification) : []),
        
        // Подписи
        new Paragraph({
          children: [
            new TextRun({
              text: 'Заказчик:',
              bold: true
            })
          ],
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: data.clientLegalName || data.clientName,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Адрес: ${data.clientLegalAddress || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Телефон: ${data.clientPhone || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Электронная почта: ${data.clientEmail || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `ОГРН: ${data.clientOgrn || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `ИНН: ${data.clientInn || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `КПП: ${data.clientKpp || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Р/счет: ${data.clientBankAccount || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `К/счет: ${data.clientCorrespondentAccount || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `БИК: ${data.clientBankBik || ''}`,
          spacing: { after: 100 }
        }),
        
        new Paragraph({
          text: '',
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Генеральный директор`,
          spacing: { after: 100 }
        }),
        
        new Paragraph({
          text: '',
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: '___________________ / ' + (data.clientDirector || 'ФИО Заказчика'),
          spacing: { after: 400 }
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: 'Исполнитель:',
              bold: true
            })
          ],
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          text: data.executorLegalName || data.executorName,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Адрес: ${data.executorAddress || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Телефон: ${data.executorPhone || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Электронная почта: ${data.executorEmail || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `ОГРНИП: ${data.executorOgrn || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `ИНН: ${data.executorInn || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `Р/с: ${data.executorBankAccount || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `К/с: ${data.executorCorrespondentAccount || ''}`,
          spacing: { after: 50 }
        }),
        
        new Paragraph({
          text: `БИК: ${data.executorBankBik || ''}`,
          spacing: { after: 100 }
        }),
        
        new Paragraph({
          text: `${data.executorDirectorPosition || 'Генеральный директор'}`,
          spacing: { after: 100 }
        }),
        
        new Paragraph({
          text: '___________________ / ' + (data.executorDirector || 'ФИО Исполнителя'),
          spacing: { after: 200 }
        })
      ]
    }]
  })
  
  return doc
}

