import { useState, useEffect } from 'react'

// Champ de saisie numérique qui affiche les milliers séparés par une virgule
// pendant que l'utilisateur tape (ex: 5000 -> 5,000), tout en renvoyant
// au parent la valeur numérique brute (sans virgule) pour les calculs.
export default function MontantInput({ value, onChange, onBlur, disabled, placeholder, className }) {
  const [affichage, setAffichage] = useState('')

  // Resynchronise l'affichage si la valeur change depuis l'extérieur (ex: chargement depuis la BDD)
  useEffect(() => {
    const brut = String(value ?? '').replace(/[^\d]/g, '')
    setAffichage(brut ? Number(brut).toLocaleString('en-US') : '')
  }, [value])

  function gererChangement(e) {
    const brut = e.target.value.replace(/[^\d]/g, '') // ne garde que les chiffres
    setAffichage(brut ? Number(brut).toLocaleString('en-US') : '')
    onChange(brut) // le parent reçoit la valeur numérique sans virgule
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder || '0'}
      value={affichage}
      onChange={gererChangement}
      onBlur={onBlur}
      className={className}
    />
  )
}
