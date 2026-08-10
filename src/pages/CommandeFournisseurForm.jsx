import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CommandeFournisseurForm({ profil }) {
  const [contactClient, setContactClient] = useState('')
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState(1)
  const [prixUnitaire, setPrixUnitaire] = useState('')
  const [montantDevis, setMontantDevis] = useState('')
  const [acompteClient, setAcompteClient] = useState('')
  const [montantBonCommande, setMontantBonCommande] = useState('')
  const [devisFile, setDevisFile] = useState(null)
  const [bonCommandeFile, setBonCommandeFile] = useState(null)
  const [observation, setObservation] = useState('')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  // Recherche / création client
  const [rechercheClient, setRechercheClient] = useState('')
  const [resultatsClients, setResultatsClients] = useState([])
  const [clientSelectionne, setClientSelectionne] = useState(null)
  const [modeCreation, setModeCreation] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouveauTelephone, setNouveauTelephone] = useState('')
  const [creationEnCours, setCreationEnCours] = useState(false)

  async function rechercherClients(texte) {
    setRechercheClient(texte)
    setClientSelectionne(null)
    if (texte.length < 2) {
      setResultatsClients([])
      return
    }
    const { data } = await supabase
      .from('clients')
      .select('id, nom, telephone')
      .eq('magasin_id', profil.magasin_id)
      .ilike('nom', `%${texte}%`)
      .limit(10)
    setResultatsClients(data || [])
  }

  function selectionnerClient(client) {
    setClientSelectionne(client)
    setContactClient(`${client.nom} — ${client.telephone || ''}`)
    setRechercheClient(client.nom)
    setResultatsClients([])
  }

  async function creerNouveauClient() {
    if (!nouveauNom.trim()) {
      setErreur('Le nom du client est obligatoire.')
      return
    }
    setCreationEnCours(true)
    setErreur('')
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          nom: nouveauNom.trim(),
          telephone: nouveauTelephone.trim() || null,
          magasin_id: profil.magasin_id,
        })
        .select()
        .single()
      if (error) throw error
      selectionnerClient(data)
      setModeCreation(false)
      setNouveauNom('')
      setNouveauTelephone('')
    } catch (err) {
      setErreur('Erreur création client : ' + err.message)
    } finally {
      setCreationEnCours(false)
    }
  }

  async function uploaderFichier(bucket, fichier) {
    const extension = fichier.name.split('.').pop()
    const chemin = `${profil.magasin_id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(bucket).upload(chemin, fichier)
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(chemin)
    return data.publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur('')

    if (!clientSelectionne) {
      setErreur('Merci de sélectionner ou créer un client.')
      return
    }
    if (!devisFile || !bonCommandeFile) {
      setErreur('Le devis et le bon de commande sont obligatoires.')
      return
    }
    if (!produit || !montantDevis || !montantBonCommande) {
      setErreur('Merci de remplir tous les champs obligatoires.')
      return
    }

    setSaving(true)
    try {
      const devisUrl = await uploaderFichier('devis-clients', devisFile)
      const bonCommandeUrl = await uploaderFichier('bons-commande', bonCommandeFile)

      const { error } = await supabase.from('commandes_fournisseur').insert({
        client_id: clientSelectionne.id,
        contact_client: contactClient,
        magasin_id: profil.magasin_id,
        responsable_id: profil.id,
        produit,
        quantite: Number(quantite),
        prix_unitaire: prixUnitaire ? Number(prixUnitaire) : null,
        devis_url: devisUrl,
        montant_devis: Number(montantDevis),
        acompte_client: Number(acompteClient) || 0,
        bon_commande_url: bonCommandeUrl,
        montant_bon_commande: Number(montantBonCommande),
        observation,
        statut: 'commandée',
      })

      if (error) throw error

      // reset du formulaire
      setContactClient('')
      setProduit('')
      setQuantite(1)
      setPrixUnitaire('')
      setMontantDevis('')
      setAcompteClient('')
      setMontantBonCommande('')
      setDevisFile(null)
      setBonCommandeFile(null)
      setObservation('')
      setRechercheClient('')
      setClientSelectionne(null)
      alert('Commande enregistrée.')
    } catch (err) {
      setErreur('Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4 p-4">
      <h2 className="text-lg font-semibold">Nouvelle commande fournisseur</h2>

      {erreur && <p className="text-red-500 text-sm">{erreur}</p>}

      <div className="relative">
        <label className="block text-sm mb-1">Client *</label>

        {!modeCreation ? (
          <>
            <input
              value={rechercheClient}
              onChange={e => rechercherClients(e.target.value)}
              placeholder="Tapez le nom du client..."
              className="w-full border rounded p-2"
              required
            />
            {resultatsClients.length > 0 && (
              <ul className="absolute z-10 bg-white dark:bg-gray-800 border rounded w-full mt-1 max-h-48 overflow-auto">
                {resultatsClients.map(c => (
                  <li
                    key={c.id}
                    onClick={() => selectionnerClient(c)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    {c.nom} {c.telephone && `— ${c.telephone}`}
                  </li>
                ))}
              </ul>
            )}
            {rechercheClient.length >= 2 && resultatsClients.length === 0 && !clientSelectionne && (
              <button
                type="button"
                onClick={() => { setModeCreation(true); setNouveauNom(rechercheClient) }}
                className="text-sm text-primary-600 mt-1 underline"
              >
                Client introuvable — créer "{rechercheClient}"
              </button>
            )}
          </>
        ) : (
          <div className="border rounded p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
            <p className="text-sm font-medium">Nouveau client</p>
            <input
              value={nouveauNom}
              onChange={e => setNouveauNom(e.target.value)}
              placeholder="Nom complet *"
              className="w-full border rounded p-2"
            />
            <input
              value={nouveauTelephone}
              onChange={e => setNouveauTelephone(e.target.value)}
              placeholder="Téléphone (optionnel)"
              className="w-full border rounded p-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={creerNouveauClient}
                disabled={creationEnCours}
                className="bg-primary-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
              >
                {creationEnCours ? 'Création...' : 'Créer et sélectionner'}
              </button>
              <button
                type="button"
                onClick={() => setModeCreation(false)}
                className="text-sm text-gray-500 underline"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {clientSelectionne && (
          <p className="text-sm text-green-600 mt-1">✓ {clientSelectionne.nom} sélectionné</p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1">Produit *</label>
        <input
          value={produit}
          onChange={e => setProduit(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm mb-1">Quantité</label>
          <input
            type="number"
            value={quantite}
            onChange={e => setQuantite(e.target.value)}
            className="w-full border rounded p-2"
            min="1"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm mb-1">Prix unitaire estimé</label>
          <input
            type="number"
            value={prixUnitaire}
            onChange={e => setPrixUnitaire(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Montant du devis (Ar) *</label>
        <input
          type="number"
          value={montantDevis}
          onChange={e => setMontantDevis(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Acompte versé par le client</label>
        <input
          type="number"
          value={acompteClient}
          onChange={e => setAcompteClient(e.target.value)}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Devis client (fichier) *</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={e => setDevisFile(e.target.files[0])}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Montant du bon de commande (Ar) *</label>
        <input
          type="number"
          value={montantBonCommande}
          onChange={e => setMontantBonCommande(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Bon de commande (fichier) *</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={e => setBonCommandeFile(e.target.files[0])}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Observation</label>
        <textarea
          value={observation}
          onChange={e => setObservation(e.target.value)}
          className="w-full border rounded p-2"
          rows="2"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary-600 text-white rounded p-3 font-semibold disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer la commande'}
      </button>
    </form>
  )
}
