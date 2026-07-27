import { rublesToWords } from '@/lib/number-to-words-ru'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function dateRu(d: Date): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface Seller {
  sellerLegalName?: string | null
  sellerName?: string | null
  sellerInn?: string | null
  sellerKpp?: string | null
  sellerOgrn?: string | null
  sellerLegalAddress?: string | null
  sellerDirectorName?: string | null
  sellerDirectorPosition?: string | null
  sellerBankAccount?: string | null
  sellerBankName?: string | null
  sellerBankBik?: string | null
  sellerCorrespondentAccount?: string | null
}

interface Buyer {
  name: string
  legalName?: string | null
  inn?: string | null
  kpp?: string | null
  legalAddress?: string | null
}

interface Inv {
  number: string
  issuedAt: Date
  planName: string
  months: number
  amount: number
  vatRate: number
  vatAmount: number
}

/** HTML российского счёта на оплату (для htmlToPdf). */
export function renderInvoiceHtml(inv: Inv, seller: Seller, buyer: Buyer, sbpQrDataUri?: string | null): string {
  const sellerName = seller.sellerLegalName || seller.sellerName || '—'
  const vatLine = inv.vatRate > 0
    ? `В том числе НДС ${inv.vatRate}%: ${money(inv.vatAmount)} ₽`
    : 'Без НДС'
  const totalWords = rublesToWords(inv.amount)

  const reqRow = (label: string, value: unknown) =>
    `<tr><td class="rl">${esc(label)}</td><td class="rv">${esc(value) || '—'}</td></tr>`

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.4; margin: 0; }
  h1 { font-size: 16px; margin: 18px 0 4px; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; }
  .bank td { border: 1px solid #333; padding: 4px 7px; vertical-align: top; }
  .bank .rl { width: 30%; color: #444; }
  .parties td { padding: 3px 6px; vertical-align: top; }
  .parties .rl { width: 130px; color: #555; }
  .items th, .items td { border: 1px solid #333; padding: 5px 7px; }
  .items th { background: #f0f0f0; text-align: left; font-weight: 600; }
  .items .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 8px; }
  .totals td { padding: 2px 6px; }
  .totals .lbl { text-align: right; color: #444; }
  .totals .val { text-align: right; white-space: nowrap; width: 130px; font-weight: 600; }
  .sign { margin-top: 26px; }
  .sign td { padding: 14px 6px 2px; vertical-align: bottom; }
  .line { border-bottom: 1px solid #333; min-width: 180px; display: inline-block; }
  .qr { float: right; text-align: center; margin-left: 16px; }
  .qr img { width: 120px; height: 120px; }
  .qr div { font-size: 10px; color: #555; margin-top: 3px; }
  .divider { border: none; border-top: 2px solid #111; margin: 14px 0; }
</style></head><body>

<table class="bank"><tbody>
  <tr>
    <td class="rl">Банк получателя</td><td>${esc(seller.sellerBankName)}</td>
    <td class="rl">БИК</td><td>${esc(seller.sellerBankBik)}</td>
  </tr>
  <tr>
    <td class="rl">Кор. счёт</td><td>${esc(seller.sellerCorrespondentAccount)}</td>
    <td class="rl">Сч. №</td><td>${esc(seller.sellerBankAccount)}</td>
  </tr>
  <tr>
    <td class="rl">Получатель<br>ИНН ${esc(seller.sellerInn)} КПП ${esc(seller.sellerKpp)}</td>
    <td colspan="3">${esc(sellerName)}</td>
  </tr>
</tbody></table>

<hr class="divider">
<h1>Счёт на оплату № ${esc(inv.number)} от ${esc(dateRu(inv.issuedAt))}</h1>
<hr class="divider">

<table class="parties"><tbody>
  <tr><td class="rl">Поставщик:</td><td><b>${esc(sellerName)}</b>, ИНН ${esc(seller.sellerInn)}${seller.sellerKpp ? `, КПП ${esc(seller.sellerKpp)}` : ''}${seller.sellerLegalAddress ? `, ${esc(seller.sellerLegalAddress)}` : ''}</td></tr>
  <tr><td class="rl">Покупатель:</td><td><b>${esc(buyer.legalName || buyer.name)}</b>${buyer.inn ? `, ИНН ${esc(buyer.inn)}` : ''}${buyer.kpp ? `, КПП ${esc(buyer.kpp)}` : ''}${buyer.legalAddress ? `, ${esc(buyer.legalAddress)}` : ''}</td></tr>
</tbody></table>

<table class="items" style="margin-top:10px"><thead>
  <tr><th style="width:28px">№</th><th>Наименование</th><th style="width:50px">Кол-во</th><th style="width:40px">Ед.</th><th style="width:90px">Цена</th><th style="width:100px">Сумма</th></tr>
</thead><tbody>
  <tr>
    <td class="num">1</td>
    <td>Подписка Manexa — тариф «${esc(inv.planName)}», ${esc(inv.months)} мес.</td>
    <td class="num">1</td>
    <td>усл.</td>
    <td class="num">${money(inv.amount)}</td>
    <td class="num">${money(inv.amount)}</td>
  </tr>
</tbody></table>

<table class="totals"><tbody>
  <tr><td class="lbl">Итого:</td><td class="val">${money(inv.amount)} ₽</td></tr>
  <tr><td class="lbl">${esc(vatLine)}</td><td class="val"></td></tr>
  <tr><td class="lbl"><b>Всего к оплате:</b></td><td class="val">${money(inv.amount)} ₽</td></tr>
</tbody></table>

<p style="margin-top:6px"><b>Всего к оплате:</b> ${esc(totalWords)}</p>

<div class="qr">
  ${sbpQrDataUri ? `<img src="${sbpQrDataUri}" alt="СБП QR"><div>Оплата по СБП</div>` : ''}
</div>

<table class="sign"><tbody>
  <tr>
    <td>${esc(seller.sellerDirectorPosition || 'Руководитель')} <span class="line"></span></td>
    <td style="width:40%">${esc(seller.sellerDirectorName)}</td>
  </tr>
</tbody></table>

</body></html>`
}

interface Act {
  actNumber: string
  actDate: Date
  planName: string
  months: number
  amount: number
  vatRate: number
  vatAmount: number
}

/** HTML акта об оказании услуг (закрывающий документ). */
export function renderActHtml(act: Act, seller: Seller, buyer: Buyer): string {
  const sellerName = seller.sellerLegalName || seller.sellerName || '—'
  const vatLine = act.vatRate > 0
    ? `В том числе НДС ${act.vatRate}%: ${money(act.vatAmount)} ₽`
    : 'Без НДС'
  const totalWords = rublesToWords(act.amount)

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.4; margin: 0; }
  h1 { font-size: 16px; margin: 4px 0 2px; }
  .parties td { padding: 3px 6px; vertical-align: top; }
  .parties .rl { width: 110px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  .items th, .items td { border: 1px solid #333; padding: 5px 7px; }
  .items th { background: #f0f0f0; text-align: left; font-weight: 600; }
  .items .num { text-align: right; white-space: nowrap; }
  .totals td { padding: 2px 6px; }
  .totals .lbl { text-align: right; color: #444; }
  .totals .val { text-align: right; white-space: nowrap; width: 130px; font-weight: 600; }
  .note { margin-top: 10px; }
  .sign { margin-top: 30px; }
  .sign td { padding: 16px 6px 2px; vertical-align: bottom; width: 50%; }
  .line { border-bottom: 1px solid #333; min-width: 160px; display: inline-block; }
</style></head><body>

<h1>Акт № ${esc(act.actNumber)} от ${esc(dateRu(act.actDate))}</h1>
<p class="muted">об оказании услуг</p>

<table class="parties"><tbody>
  <tr><td class="rl">Исполнитель:</td><td><b>${esc(sellerName)}</b>, ИНН ${esc(seller.sellerInn)}${seller.sellerKpp ? `, КПП ${esc(seller.sellerKpp)}` : ''}</td></tr>
  <tr><td class="rl">Заказчик:</td><td><b>${esc(buyer.legalName || buyer.name)}</b>${buyer.inn ? `, ИНН ${esc(buyer.inn)}` : ''}${buyer.kpp ? `, КПП ${esc(buyer.kpp)}` : ''}</td></tr>
</tbody></table>

<table class="items" style="margin-top:10px"><thead>
  <tr><th style="width:28px">№</th><th>Наименование услуги</th><th style="width:50px">Кол-во</th><th style="width:40px">Ед.</th><th style="width:100px">Сумма</th></tr>
</thead><tbody>
  <tr>
    <td class="num">1</td>
    <td>Доступ к сервису Manexa — тариф «${esc(act.planName)}», ${esc(act.months)} мес.</td>
    <td class="num">1</td>
    <td>усл.</td>
    <td class="num">${money(act.amount)}</td>
  </tr>
</tbody></table>

<table class="totals"><tbody>
  <tr><td class="lbl">Итого:</td><td class="val">${money(act.amount)} ₽</td></tr>
  <tr><td class="lbl">${esc(vatLine)}</td><td class="val"></td></tr>
  <tr><td class="lbl"><b>Всего оказано услуг на сумму:</b></td><td class="val">${money(act.amount)} ₽</td></tr>
</tbody></table>

<p class="note">Всего оказано услуг на сумму: ${esc(totalWords)}</p>
<p class="note">Вышеперечисленные услуги выполнены полностью и в срок. Заказчик по объёму, качеству и срокам оказания услуг претензий не имеет.</p>

<table class="sign"><tbody>
  <tr>
    <td><b>Исполнитель</b><br><br>${esc(seller.sellerDirectorPosition || 'Руководитель')} <span class="line"></span> ${esc(seller.sellerDirectorName)}</td>
    <td><b>Заказчик</b><br><br><span class="line"></span></td>
  </tr>
</tbody></table>

</body></html>`
}
