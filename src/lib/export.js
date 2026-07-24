import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const HEADERS = ['Date', 'Magasin', 'Responsable', 'Espèces', 'Chèque', 'Mobile Money', 'Différés', 'Encaissements', 'Sorties', 'Résultat', 'Solde caisse']

function toRows(rapports) {
  return rapports.map((r) => [
    r.date, r.magasins?.nom || '', r.profils?.nom || '',
    r.espèces, r.chèque, r.mobile_money, r.différés, r.total_encaissements || 0, r.total_sorties, r.résultat, r.solde,
  ])
}

export function exporterExcel(rapports, nomFichier = 'rapports.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toRows(rapports)])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rapports')
  XLSX.writeFile(wb, nomFichier)
}

export function exporterCSV(rapports, nomFichier = 'rapports.csv') {
  const rows = [HEADERS, ...toRows(rapports)]
  const csv = rows.map((r) => r.join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomFichier; a.click()
  URL.revokeObjectURL(url)
}

export function exporterPDF(rapports, nomFichier = 'rapports.pdf') {
  const doc = new jsPDF()
  doc.text('Rapports de caisse', 14, 15)
  autoTable(doc, { head: [HEADERS], body: toRows(rapports), startY: 20 })
  doc.save(nomFichier)
}

export function exporterRapportUniquePDF(rapport) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(`Rapport de caisse - ${rapport.magasins?.nom || ''}`, 14, 15)
  doc.setFontSize(11)
  doc.text(`Date : ${rapport.date}`, 14, 25)
  doc.text(`Responsable : ${rapport.profils?.nom || ''}`, 14, 32)
  autoTable(doc, {
    startY: 40,
    body: [
      ['Espèces', rapport.espèces],
      ['Chèque', rapport.chèque],
      ['Mobile Money', rapport.mobile_money],
      ['Différés', rapport.différés],
      ['Total ventes', rapport.total_ventes],
      ['Encaissements clients (dettes anciennes)', rapport.total_encaissements || 0],
      ['Total sorties', rapport.total_sorties],
      ['Résultat', rapport.résultat],
      ['Cash veille', rapport.solde_veille],
      ['Cash physique en caisse', rapport.solde],
    ],
  })
  if (rapport.sorties?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Libellé', 'Catégorie', 'Montant']],
      body: rapport.sorties.map((s) => [s.libellé, s.categorie_depense || (s.catégorie === 'versement' ? 'Versement' : '-'), s.montant]),
    })
  }
  doc.save(`rapport-${rapport.date}.pdf`)
}
