import type { ShiftReportData } from '@/types/database'
import { fmt, formatDate, formatTime, periodLabel, categoryLabel } from './index'

// ============================================================
// Shift Report HTML (used for both PDF print and browser print)
// This is injected into a print window or converted via jsPDF
// ============================================================
export function generateShiftReportHTML(report: ShiftReportData): string {
  const salesRows = report.sales.map(sale => `
    <tr>
      <td>${formatTime(sale.created_at)}</td>
      <td>${sale.invoice_number ?? ''}</td>
      <td>${sale.customer_name ?? 'Anonimo'}${sale.customer_nationality ? `  ${sale.customer_nationality}` : ''}</td>
      <td>${sale.items?.map(i => `${i.product_name} ${i.qty}`).join(', ') ?? ''}</td>
      <td>${sale.payment_method === 'cash' ? 'Cash' : 'POS'}</td>
      <td style="text-align:right; font-weight:600">${fmt(sale.total)}</td>
    </tr>
  `).join('')

  const expenseRows = report.expenses.map(e => `
    <tr>
      <td>${formatTime(e.created_at)}</td>
      <td colspan="4">${e.description}</td>
      <td style="text-align:right; color:#EF4444; font-weight:600">${fmt(e.amount)}</td>
    </tr>
  `).join('')

  const variance = report.cash_variance ?? 0
  const varianceColor = variance < 0 ? '#EF4444' : variance > 0 ? '#22C55E' : '#1A1A1A'

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Riepilogo Turno  ${report.store_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #1A1A1A; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #22C55E; }
  .logo { font-size: 20px; font-weight: 700; color: #22C55E; }
  .meta { text-align: right; color: #6B7280; font-size: 11px; }
  .meta strong { color: #1A1A1A; display: block; font-size: 13px; }
  h2 { font-size: 13px; font-weight: 700; color: #1A1A1A; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #E5E7EB; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { font-size: 10px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; text-align: left; background: #F6F7F8; border-bottom: 1px solid #E5E7EB; }
  td { padding: 6px 8px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .summary-box { background: #F6F7F8; border-radius: 8px; padding: 12px; }
  .summary-box h3 { font-size: 11px; color: #9CA3AF; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
  .cash-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .cash-row.total { border-top: 1px solid #E5E7EB; margin-top: 6px; padding-top: 6px; font-weight: 700; font-size: 13px; }
  .variance { font-weight: 700; color: ${varianceColor}; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; color: #9CA3AF; font-size: 10px; }
  .signature-line { margin-top: 32px; display: flex; gap: 40px; }
  .signature-box { flex: 1; border-top: 1px solid #9CA3AF; padding-top: 6px; font-size: 10px; color: #6B7280; }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo"> MamaMary</div>
    <div style="color:#6B7280; font-size:12px; margin-top:4px">Riepilogo Turno  Busta Cassa</div>
  </div>
  <div class="meta">
    <strong>${report.store_name}</strong>
    ${report.date}  ${periodLabel[report.period]}<br>
    ${report.employee_name}<br>
    Apertura: ${report.opened_at}${report.closed_at ? `  Chiusura: ${report.closed_at}` : ''}
  </div>
</div>

<div class="summary-grid">
  <div class="summary-box">
    <h3>Riepilogo Cassa</h3>
    <div class="cash-row"><span>FCE</span><span>${fmt(report.fce)}</span></div>
    <div class="cash-row"><span>+ Vendite Cash</span><span>${fmt(report.total_cash)}</span></div>
    <div class="cash-row"><span> Spese</span><span>${fmt(report.total_expenses)}</span></div>
    <div class="cash-row"><span> FCU</span><span>${fmt(report.fcu ?? 0)}</span></div>
    <div class="cash-row total"><span>= Deposito Atteso</span><span>${fmt(report.deposit_expected)}</span></div>
    ${report.deposit_actual != null ? `<div class="cash-row total"><span>Deposito Effettivo</span><span>${fmt(report.deposit_actual)}</span></div>` : ''}
    ${report.cash_variance != null ? `<div class="cash-row total"><span>Varianza</span><span class="variance">${fmt(report.cash_variance)}</span></div>` : ''}
  </div>
  <div class="summary-box">
    <h3>Vendite</h3>
    <div class="cash-row"><span>Totale Vendite</span><span style="font-weight:700">${fmt(report.total_sales)}</span></div>
    <div class="cash-row"><span>Cash (${report.sales.filter(s => s.payment_method === 'cash').length} txn)</span><span>${fmt(report.total_cash)}</span></div>
    <div class="cash-row"><span>POS (${report.sales.filter(s => s.payment_method === 'pos').length} txn)</span><span>${fmt(report.total_pos)}</span></div>
    <div class="cash-row"><span>N Transazioni</span><span>${report.total_transactions}</span></div>
    <div class="cash-row"><span>Spese Totali</span><span style="color:#EF4444">${fmt(report.total_expenses)}</span></div>
  </div>
</div>

<h2>Dettaglio Vendite (${report.sales.length})</h2>
<table>
  <thead>
    <tr>
      <th>Ora</th><th>Fattura</th><th>Cliente</th><th>Prodotti</th><th>Metodo</th><th style="text-align:right">Totale</th>
    </tr>
  </thead>
  <tbody>${salesRows || '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:16px">Nessuna vendita</td></tr>'}</tbody>
</table>

${report.expenses.length > 0 ? `
<h2>Spese (${report.expenses.length})</h2>
<table>
  <thead>
    <tr><th>Ora</th><th colspan="4">Descrizione</th><th style="text-align:right">Importo</th></tr>
  </thead>
  <tbody>${expenseRows}</tbody>
</table>` : ''}

<div class="signature-line">
  <div class="signature-box">Firma Dipendente: ${report.employee_name}</div>
  <div class="signature-box">Firma Responsabile</div>
  <div class="signature-box">Data: ${report.date}</div>
</div>

<div class="footer">
  <span> MamaMary Retail Management System</span>
  <span>Generato il ${new Date().toLocaleString('it-IT')}</span>
</div>

</body>
</html>`
}

// ============================================================
// Trigger browser print (replaces current window)
// ============================================================
export function printShiftReport(report: ShiftReportData) {
  const html = generateShiftReportHTML(report)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
  }
}

// ============================================================
// Excel export (CSV format, opens in Excel)
// ============================================================
export function exportShiftCSV(report: ShiftReportData) {
  const rows: string[][] = []

  // Header info
  rows.push(['MamaMary  Riepilogo Turno'])
  rows.push(['Negozio', report.store_name])
  rows.push(['Dipendente', report.employee_name])
  rows.push(['Data', report.date])
  rows.push(['Turno', periodLabel[report.period]])
  rows.push([''])

  // Cash summary
  rows.push(['RIEPILOGO CASSA'])
  rows.push(['FCE', report.fce.toString()])
  rows.push(['Vendite Cash', report.total_cash.toString()])
  rows.push(['Spese', (-report.total_expenses).toString()])
  rows.push(['FCU', (-(report.fcu ?? 0)).toString()])
  rows.push(['Deposito Atteso', report.deposit_expected.toString()])
  if (report.deposit_actual != null) rows.push(['Deposito Effettivo', report.deposit_actual.toString()])
  if (report.cash_variance != null) rows.push(['Varianza', report.cash_variance.toString()])
  rows.push([''])

  // Sales
  rows.push(['VENDITE'])
  rows.push(['Ora', 'Fattura', 'Cliente', 'Nazionalita', 'Prodotti', 'Metodo', 'Subtotale', 'Sconto', 'Totale'])
  for (const sale of report.sales) {
    rows.push([
      formatTime(sale.created_at),
      sale.invoice_number ?? '',
      sale.customer_name ?? 'Anonimo',
      sale.customer_nationality ?? '',
      sale.items?.map(i => `${i.product_name} x${i.qty}`).join(' | ') ?? '',
      sale.payment_method,
      sale.subtotal.toString(),
      sale.discount_amount.toString(),
      sale.total.toString(),
    ])
  }
  rows.push([''])

  // Expenses
  rows.push(['SPESE'])
  rows.push(['Ora', 'Descrizione', 'Importo'])
  for (const exp of report.expenses) {
    rows.push([formatTime(exp.created_at), exp.description, exp.amount.toString()])
  }

  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `riepilogo_${report.date.replace(/\//g, '-')}_${report.store_name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
