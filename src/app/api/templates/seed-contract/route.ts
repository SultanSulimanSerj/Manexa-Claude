import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

// Шаблон договора с переменными
const CONTRACT_TEMPLATE = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Договор подряда</title>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 2cm;
            text-align: justify;
        }
        h1 {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h2 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .date-place {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .signatures {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .signature-block {
            padding: 20px 0;
        }
        .signature-line {
            margin-top: 30px;
            border-bottom: 1px solid black;
            padding-bottom: 5px;
        }
        p {
            margin: 10px 0;
        }
        .bold {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ДОГОВОР № {{contract.number}}</h1>
    </div>

    <div class="date-place">
        <span>г. {{city}}</span>
        <span>"{{contract.day}}" {{contract.month}} {{contract.year}} г.</span>
    </div>

    <p>
        {{client.legalName}}, в лице {{client.director}}, действующего на основании Устава, именуемое в дальнейшем «Заказчик» и
        {{executor.legalName}}, действующий на основании Свидетельства о государственной регистрации ИП именуемый в дальнейшем «Исполнитель», 
        с другой стороны, именуемые в дальнейшем «Стороны», заключили настоящий Договор (далее-Договор) о нижеследующем.
    </p>

    <h2>1. Предмет договора</h2>
    <p>
        1.1. Исполнитель обязуется выполнить комплекс строительно-монтажных и ремонтных работ по адресу: {{project.address}}, 
        согласно спецификациям к Договору, являющимся неотъемлемой его частью (далее-Спецификация), а Заказчик принять работы 
        и оплатить выполненные Исполнителем Работы.
    </p>
    <p>1.2. Срок выполнения и место выполнения Работ указаны в соответствующей Спецификации к Договору.</p>
    <p>
        1.3. Исключительные авторские права на схему коммутации оборудования и проводки кабеля принадлежат Исполнителю. 
        Заказчик имеет право использовать схему коммутации и дополнительную консультационную информацию лишь в целях, определяемых настоящим Договором.
    </p>

    <h2>2. Стоимость и порядок расчетов</h2>
    <p>
        2.1 Цена Договора складывается из стоимости всех Спецификаций, заключенных Сторонами в период действия Договора, {{estimate.vatEnabled}}.
    </p>
    <p>
        2.2 Заказчик производит авансовый платеж в размере 50% от стоимости Работ, указанной в соответствующей Спецификации, 
        в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, путем перечисления денежных средств на расчетный счет Исполнителя.
    </p>
    <p>
        Заказчик производит окончательную оплату в размере 50% от стоимости Работ, указанной в соответствующей Спецификации, 
        в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, выставленного после подписания актов по форме КС-2, КС-3.
    </p>
    <p>
        Заказчик производит платеж в размере 100% от стоимости материалов, указанной в соответствующей Спецификации, 
        в течение 5 (пяти) рабочих дней с даты получения от Исполнителя счета, путем перечисления денежных средств на расчетный счет Исполнителя.
    </p>
    <p>
        2.3 Оплата по Договору производится в Российских рублях. Днем оплаты считается день списания денежных средств 
        с корреспондентского счета банка Заказчика.
    </p>

    <h2>3. Обязанности сторон</h2>
    <p class="bold">3.1 Исполнитель обязуется:</p>
    <p>
        3.1.1. На основании предоставленных Заказчиком планов (схем) помещений, фасада, кровли здания, схемы проводки слаботочных 
        и силовых линий связи и/или предварительно проведенной работы по обследованию объекта Заказчика (услуга оплачивается отдельно), 
        в соответствии с его пожеланиями, составить предварительный расчет по поставке, монтажу и настройке оборудования.
    </p>
    <p>
        3.1.2. Передать Заказчику оборудование пригодное к эксплуатации в порядке и в сроки, предусмотренные настоящим Договором. 
        Исполнитель гарантирует, что оборудование передается новым, не бывшим в употреблении, под арестом и залогом не состоит.
    </p>
    <p>3.1.3. Производить Работы надлежащего качества в сроки, предусмотренные соответствующей Спецификации.</p>
    <p>3.1.4. Предоставлять Заказчику по его запросу необходимую информацию о порядке и ходе выполнения Работ.</p>
    <p>3.1.5. Информировать Заказчика об обстоятельствах, влияющих на срок исполнения обязательств по Договору.</p>
    <p>3.1.6. Выполнять надлежащим образом иные обязанности, предусмотренные Договором и законодательством Российской Федерации.</p>

    <p class="bold">3.2 Заказчик обязуется:</p>
    <p>3.2.1. Принять и оплатить оборудование и Работы согласно п. 2 настоящего Договора.</p>
    <p>3.2.2. Оказывать содействие Исполнителю в случаях, в объеме и порядке предусмотренных Договором и приложениями к нему.</p>
    <p>
        3.2.3. Предоставить Исполнителю свободный доступ во все технические, жилые и нежилые помещения, необходимые для выполнения Работ 
        и всячески способствовать их выполнению в кратчайшие сроки.
    </p>
    <p>
        3.2.4. В день доставки оборудования и проведения Работ предоставить место для складирования за свой счет в приспособленном 
        для этих целей охраняемом помещении, до и во время монтажных Работ.
    </p>
    <p>3.2.5. Подготовить помещения для проведения монтажных Работ.</p>
    <p>3.2.6. На время выполнения Работ обеспечить электроснабжением, позволяющим вести работу электроинструментом мощностью 1500 Ватт.</p>
    <p>
        3.2.7. Незамедлительно информировать Исполнителя о возможных дефектах установленного оборудования, возникших в течение эксплуатации гарантийного срока.
    </p>

    <div class="signatures">
        <div class="signature-block">
            <p class="bold">ЗАКАЗЧИК:</p>
            <p>{{client.legalName}}</p>
            <p>ИНН: {{client.inn}}</p>
            <p>КПП: {{client.kpp}}</p>
            <p>Адрес: {{client.legalAddress}}</p>
            <p>Тел.: {{client.phone}}</p>
            <p>Email: {{client.email}}</p>
            <div class="signature-line">
                ___________________ / {{client.director}}
            </div>
        </div>

        <div class="signature-block">
            <p class="bold">ИСПОЛНИТЕЛЬ:</p>
            <p>{{executor.legalName}}</p>
            <p>ИНН: {{executor.inn}}</p>
            <p>ОГРНИП: {{executor.ogrnip}}</p>
            <p>Адрес: {{executor.legalAddress}}</p>
            <p>Тел.: {{executor.phone}}</p>
            <p>Email: {{executor.email}}</p>
            <div class="signature-line">
                ___________________ / {{executor.director}}
            </div>
        </div>
    </div>
</body>
</html>`

export async function POST(request: NextRequest) {
  try {
    const { allowed, user, error } = await checkPermission(request, 'canEditDocuments')

    if (!allowed || !user?.companyId) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 })
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Создаем шаблон договора
    const template = await prisma.documentTemplate.create({
      data: {
        name: 'Договор подряда',
        description: 'Стандартный договор на выполнение строительно-монтажных работ',
        category: 'CONTRACT',
        fileType: 'HTML',
        content: CONTRACT_TEMPLATE,
        creatorId: user.id,
        variables: {
          contract: ['number', 'date', 'day', 'month', 'year'],
          city: 'string',
          executor: ['name', 'legalName', 'director', 'inn', 'ogrnip', 'address', 'phone', 'email'],
          client: ['name', 'legalName', 'director', 'inn', 'kpp', 'address', 'phone', 'email'],
          project: ['name', 'description', 'address', 'startDate', 'endDate'],
          estimate: ['total', 'totalWithVat', 'vatEnabled'],
        },
        companyId: user.companyId,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description
      }
    })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании шаблона', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

