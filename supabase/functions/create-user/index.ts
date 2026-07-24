// Edge Function: create-user
// Permet à l'admin de créer un compte responsable sans exposer la clé service_role au frontend.
//
// Déploiement:
//   supabase functions deploy create-user
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx (déjà dispo par défaut dans l'env des Edge Functions)
//
// Appel depuis le frontend (uniquement si l'utilisateur connecté est admin):
//   await supabase.functions.invoke('create-user', { body: { email, password, nom, magasin_id } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Vérifie que l'appelant est bien un admin
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 })

    const { data: profil } = await supabaseClient.from('profils').select('role').eq('id', user.id).single()
    if (profil?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Réservé aux administrateurs' }), { status: 403 })
    }

    const { email, password, nom, magasin_id } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (error) throw error

    const { error: profilError } = await supabaseAdmin.from('profils').insert({
      id: newUser.user.id, nom, email, role: 'responsable', magasin_id
    })
    if (profilError) throw profilError

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})
