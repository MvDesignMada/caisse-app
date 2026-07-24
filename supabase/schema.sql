-- ============================================================
-- SCHEMA COMPLET - Gestion de caisse multi-magasins
-- A exécuter dans Supabase > SQL Editor
-- ============================================================

-- Extension pour UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: magasins
-- ============================================================
create table magasins (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  created_at timestamptz default now()
);

insert into magasins (nom) values ('Magasin 1'), ('Magasin 2');

-- ============================================================
-- TABLE: profils (miroir de auth.users, car on ne peut pas
-- ajouter de colonnes custom directement sur auth.users)
-- ============================================================
create table profils (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  email text not null,
  role text not null check (role in ('admin', 'responsable')),
  magasin_id uuid references magasins(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: rapports
-- ============================================================
create table rapports (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  magasin_id uuid not null references magasins(id),
  responsable_id uuid not null references profils(id),
  espèces numeric(12,2) not null default 0,        -- cash reçu aujourd'hui (seul montant qui impacte la caisse physique)
  chèque numeric(12,2) not null default 0,          -- paiements par chèque (vente réelle, ne touche pas le cash)
  mobile_money numeric(12,2) not null default 0,    -- Mvola / Orange Money etc. (vente réelle, ne touche pas le cash)
  différés numeric(12,2) not null default 0,        -- ventes à crédit (le client n'a pas encore payé)
  total_ventes numeric(12,2) generated always as (espèces + chèque + mobile_money + différés) stored,
  total_sorties numeric(12,2) not null default 0,   -- inclut les dépenses ET les versements (voir table sorties)
  résultat numeric(12,2) generated always as (espèces + chèque + mobile_money + différés - total_sorties) stored, -- profit du jour (chiffre d'affaires - sorties)
  solde_veille numeric(12,2) not null default 0,    -- cash physique restant en caisse depuis la veille (non versé)
  solde numeric(12,2) generated always as (solde_veille + espèces - total_sorties) stored, -- cash physique réel dans le tiroir
  observation text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'validé')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (magasin_id, date) -- un seul rapport par magasin et par jour
);

-- ============================================================
-- TABLE: sorties (lignes dynamiques de sortie de caisse)
-- ============================================================
create table sorties (
  id uuid primary key default uuid_generate_v4(),
  rapport_id uuid not null references rapports(id) on delete cascade,
  libellé text not null,
  montant numeric(12,2) not null,
  catégorie text not null default 'dépense' check (catégorie in ('dépense', 'versement')),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: notifications (in-app uniquement, pas d'email/push)
-- ============================================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  rapport_id uuid references rapports(id) on delete cascade,
  message text not null,
  lue boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- VUE: dernier versement par magasin (pour afficher "caisse non versée depuis...")
-- ============================================================
create view dernier_versement with (security_invoker = true) as
select r.magasin_id, max(r.date) as date_dernier_versement
from sorties s
join rapports r on r.id = s.rapport_id
where s.catégorie = 'versement'
group by r.magasin_id;

-- ============================================================
-- FONCTION: recalcule total_sorties quand on ajoute/supprime une sortie
-- ============================================================
create or replace function update_total_sorties()
returns trigger as $$
begin
  update rapports
  set total_sorties = coalesce((
    select sum(montant) from sorties where rapport_id = coalesce(new.rapport_id, old.rapport_id)
  ), 0),
  updated_at = now()
  where id = coalesce(new.rapport_id, old.rapport_id);
  return null;
end;
$$ language plpgsql security definer;

create trigger trg_sorties_insert
after insert or update or delete on sorties
for each row execute function update_total_sorties();

-- ============================================================
-- FONCTION: notifie l'admin quand un rapport passe à "validé"
-- ============================================================
create or replace function notify_on_validation()
returns trigger as $$
begin
  if new.statut = 'validé' and (old.statut is distinct from 'validé') then
    insert into notifications (rapport_id, message)
    values (new.id, 'Rapport envoyé pour le ' || new.date::text);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_rapport_validation
after update on rapports
for each row execute function notify_on_validation();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table magasins enable row level security;
alter table profils enable row level security;
alter table rapports enable row level security;
alter table sorties enable row level security;
alter table notifications enable row level security;

-- Fonction utilitaire: récupère le rôle et le magasin de l'utilisateur connecté
create or replace function auth_role() returns text as $$
  select role from profils where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_magasin() returns uuid as $$
  select magasin_id from profils where id = auth.uid();
$$ language sql stable security definer;

-- MAGASINS: tout le monde authentifié peut lire (pour la liste)
create policy "magasins_select" on magasins for select using (auth.uid() is not null);
create policy "magasins_admin_write" on magasins for all using (auth_role() = 'admin');

-- PROFILS: chacun voit son propre profil, l'admin voit tout
create policy "profils_select_self" on profils for select using (id = auth.uid() or auth_role() = 'admin');
create policy "profils_admin_write" on profils for insert with check (auth_role() = 'admin');
create policy "profils_admin_update" on profils for update using (auth_role() = 'admin');

-- RAPPORTS:
-- Admin: accès total
create policy "rapports_admin_all" on rapports for all using (auth_role() = 'admin');

-- Responsable: peut voir uniquement le rapport du jour de SON magasin (pas l'historique)
create policy "rapports_resp_select_today" on rapports for select
  using (auth_role() = 'responsable' and magasin_id = auth_magasin() and date = current_date);

-- Responsable: peut créer le rapport du jour pour son magasin
create policy "rapports_resp_insert" on rapports for insert
  with check (auth_role() = 'responsable' and magasin_id = auth_magasin() and date = current_date and responsable_id = auth.uid());

-- Responsable: peut modifier uniquement tant que non validé et que c'est aujourd'hui
create policy "rapports_resp_update" on rapports for update
  using (auth_role() = 'responsable' and magasin_id = auth_magasin() and date = current_date and statut = 'brouillon');

-- SORTIES: héritent des droits du rapport parent
create policy "sorties_admin_all" on sorties for all using (auth_role() = 'admin');

create policy "sorties_resp_select" on sorties for select using (
  exists (select 1 from rapports r where r.id = sorties.rapport_id and r.magasin_id = auth_magasin() and r.date = current_date)
);

create policy "sorties_resp_write" on sorties for insert with check (
  exists (select 1 from rapports r where r.id = sorties.rapport_id and r.magasin_id = auth_magasin() and r.date = current_date and r.statut = 'brouillon')
);

create policy "sorties_resp_delete" on sorties for delete using (
  exists (select 1 from rapports r where r.id = sorties.rapport_id and r.magasin_id = auth_magasin() and r.date = current_date and r.statut = 'brouillon')
);

-- NOTIFICATIONS: uniquement l'admin
create policy "notifications_admin" on notifications for all using (auth_role() = 'admin');

-- ============================================================
-- IMPORTANT: création des comptes utilisateurs
-- ============================================================
-- Supabase Auth ne permet pas de créer un compte pour un tiers depuis
-- le frontend avec la clé publique (anon key). Il faut passer par une
-- Edge Function utilisant la clé service_role (jamais exposée au client).
-- Voir supabase/functions/create-user/index.ts fourni séparément.
