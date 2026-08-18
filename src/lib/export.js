import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const HEADERS = ['Date', 'Magasin', 'Responsable', 'Espèces', 'Chèque', 'Mobile Money', 'Différés', 'Encaissements', 'Sorties', 'Résultat', 'Solde caisse']

// Formate un nombre avec des virgules comme séparateur de milliers : 13455000 -> "13,455,000"
function fmt(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return ''
  return Number(valeur).toLocaleString('en-US')
}

function toRows(rapports) {
  return rapports.map((r) => [
    r.date, r.magasins?.nom || '', r.profils?.nom || '',
    fmt(r.espèces), fmt(r.chèque), fmt(r.mobile_money), fmt(r.différés),
    fmt(r.total_encaissements || 0), fmt(r.total_sorties), fmt(r.résultat), fmt(r.solde),
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
      ['Espèces', fmt(rapport.espèces)],
      ['Chèque', fmt(rapport.chèque)],
      ['Mobile Money', fmt(rapport.mobile_money)],
      ['Différés', fmt(rapport.différés)],
      ['Total ventes', fmt(rapport.total_ventes)],
      ['Encaissements clients (dettes anciennes)', fmt(rapport.total_encaissements || 0)],
      ['Total sorties', fmt(rapport.total_sorties)],
      ['Résultat', fmt(rapport.résultat)],
      ['Cash veille', fmt(rapport.solde_veille)],
      ['Cash physique en caisse', fmt(rapport.solde)],
    ],
  })
  if (rapport.sorties?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Libellé', 'Catégorie', 'Montant']],
      body: rapport.sorties.map((s) => [
        s.libellé,
        s.categorie_depense || (s.catégorie === 'versement' ? 'Versement' : '-'),
        fmt(s.montant),
      ]),
    })
  }
  doc.save(`rapport-${rapport.date}.pdf`)
}
