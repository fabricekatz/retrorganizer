# Organizer — Spec de conception (MVP 1)

> PIM « organiseur de bureau » inspiré de Lotus Organizer.
> Web responsive d'abord (desktop prioritaire), mobile en V2.

**Date** : 2026-06-25
**Statut** : Validé pour rédaction du plan d'implémentation

---

## 1. Décisions verrouillées

| Axe | Choix | Notes |
|---|---|---|
| Plateforme | Web responsive d'abord (desktop prioritaire), mobile RN en V2 | |
| Données | Cloud-first | |
| Backend | Firebase : Firestore + Auth + Storage + Cloud Functions | Conservé malgré nature NoSQL (cf. §6) |
| Stack front | React + TypeScript + Vite | |
| Monorepo | pnpm workspaces + Turborepo | Prépare le partage web↔mobile |
| Recherche globale | Index côté client (MiniSearch) | Pas de full-text natif Firestore |
| UI | Rétro « esprit » moderne | Évite le risque juridique du clone littéral |
| Chiffrement au niveau du champ (E2E) | **Reporté en V2** | MVP s'appuie sur chiffrement at-rest Firestore + Security Rules |
| Périmètre 1er livrable | MVP 1 du PRD | Calendrier, Tâches, Contacts, Notes, recherche, rappels, import/export ICS/vCard, coque rétro |

---

## 2. Objectif du MVP 1

Livrer une application web unifiée donnant la sensation d'un organiseur papier numérique :
calendrier, tâches, contacts et notes dans une coque à onglets dense et navigable au clavier,
avec recherche globale, rappels, corbeille, et import/export ICS/vCard. Comptes utilisateurs
et synchronisation cloud inclus (cloud-first).

**Hors périmètre MVP 1** (V2+) : Planner annuel, Journal d'appels, Liens web, app mobile,
chiffrement de champ, thèmes visuels, collaboration, API publique.

---

## 3. Architecture technique

### 3.1 Structure du monorepo

```
apps/
  web/         React + Vite + TypeScript — le MVP livré
  mobile/      React Native — V2 (placeholder)
packages/
  core/        Cœur métier PARTAGEABLE (plateforme-agnostique) :
               - modèles de domaine + validation (zod)
               - moteur de récurrence (rrule.js)
               - import/export ICS / vCard / CSV
               - index de recherche (MiniSearch)
               - couche d'accès données (repositories sur Firebase JS SDK)
  ui/          Design system rétro : tokens, primitives, composants
functions/     Cloud Functions (rappels planifiés, jobs de maintenance)
```

Le SDK Firebase JS fonctionne aussi en React Native → `packages/core` est réutilisé à ~80 %
pour le mobile en V2. C'est le levier qui rend la stratégie « web d'abord / mobile ensuite »
rentable : aucune réécriture de la logique métier.

### 3.2 Couches

- **`core/repositories`** : API d'accès données abstraite (`ContactsRepo`, `EventsRepo`…),
  une implémentation Firestore. Les apps ne parlent jamais directement à Firestore.
- **Hooks React** (`apps/web`) : wrappent les repositories + listeners Firestore temps réel.
- **Offline** : persistance Firestore (IndexedDB) activée → chargement rapide, résilience réseau.

### 3.3 Outillage

- **Build** : Vite (web), Turborepo (cache de tâches monorepo).
- **Qualité** : ESLint + Prettier + TypeScript strict.
- **Tests** : Vitest + React Testing Library (unitaires/intégration), Playwright (E2E parcours critiques).
- **CI** : lint + typecheck + tests sur chaque PR ; déploiement Firebase Hosting.

---

## 4. Modèle de données (Firestore)

Collections **top-level**, isolées par `ownerId` + Security Rules
(`request.auth.uid == resource.data.ownerId`). Champs communs à toutes les entités :
`id`, `ownerId`, `createdAt`, `updatedAt`, `deletedAt` (soft-delete).

### 4.1 Collections MVP 1

**`contacts`**
- `firstName`, `lastName`, `displayName`, `organization`, `title`
- `phones[]` (`{label, value}`), `emails[]`, `addresses[]` (`{label, street, city, postalCode, country}`)
- `webLinks[]` (`{label, url}`), `importantDates[]` (`{label, date}` → source des anniversaires V2)
- `notes` (texte libre), `customFields[]` (`{key, value}`), `categoryId`, `tags[]`

**`events`**
- `title`, `start`, `end`, `allDay` (bool), `location`, `notes`
- `recurrence` (chaîne RRULE | null), `recurrenceExceptions[]` (dates exclues)
- `reminderOffsets[]` (minutes avant le début → matérialisés en docs `reminders`)
- `contactIds[]`, `taskIds[]`, `categoryId`, `color`, `tags[]`

**`tasks`**
- `title`, `description`, `priority` (`low|normal|high`), `dueDate | null`
- `status` (`todo|in_progress|done`), `completedAt`
- `subtasks[]` (`{title, done}`), `recurrence` (RRULE | null)
- `contactIds[]`, `eventId | null`, `categoryId`, `tags[]`

**`notes`**
- `sectionId`, `title`, `body` (rich text sérialisé JSON), `linkedEntities[]` (`{type, id}`)
- `tags[]`

**`noteSections`** : `name`, `order` (carnets/chapitres)

**`categories`** : `name`, `color`, `module` (`event|task|contact|note`)

**`reminders`** : `entityType`, `entityId`, `fireAt` (timestamp), `status` (`pending|sent|dismissed`),
`channel` (`push|in_app`) — documents queryables par la Cloud Function planifiée.

### 4.2 Relations (non destructives)

- Liens par **tableaux d'IDs** ; requêtes inverses via `array-contains`
  (ex. « événements d'un contact » : `where('contactIds','array-contains', contactId)`).
- Suppression d'une entité → ses IDs restent dans les autres mais sont ignorés à l'affichage
  (résolution tolérante aux IDs orphelins) ; nettoyage paresseux à l'édition.

### 4.3 Index composites

Prévoir les index Firestore pour : `ownerId + start` (events), `ownerId + dueDate + status` (tasks),
`ownerId + deletedAt` (corbeille), `contactIds array-contains + ownerId`. Déclarés dans
`firestore.indexes.json`.

---

## 5. Modules & exigences

### 5.1 Coque UI rétro (transverse)

Fenêtre unique : **barre de menus** en haut + **barre d'outils compacte** + **onglets verticaux
colorés** (8 sections, un accent couleur par module) + zone « page » encadrée façon classeur.
Navigation clavier prioritaire (raccourcis par section, création rapide), forte densité,
retour visuel immédiat. Les 8 onglets sont présents dès le départ ; Planner/Anniversary/Web/Calls
affichent un état « bientôt disponible ».

Palette d'accents par module (à affiner en design) : Diary, ToDo, Address, Notepad, Planner,
Anniversary, Web, Calls.

### 5.2 Contacts (Phase 1)

CRUD complet, champs multi-valeurs (téléphones, emails, adresses, liens, dates importantes),
notes, champs personnalisés. Import/export **vCard** (3.0/4.0) + CSV. Recherche/tri.

### 5.3 Calendrier / Diary (Phase 2)

Créer/modifier/déplacer/supprimer événements. Vues **jour / semaine / mois / agenda**.
Événements récurrents (RRULE) avec exceptions. Rappels configurables. Lien événement ↔ contact
et ↔ tâche. Règle : `end ≥ start` (validée dans `core`). Import/export **ICS**.

### 5.4 Tâches (Phase 3)

Liste avec priorité, échéance, statut, sous-étapes simples, répétition (RRULE).
Filtres par date/statut/catégorie/contexte. Lien tâche ↔ contact et ↔ événement.
Tâches terminées historisées (non supprimées).

### 5.5 Notes (Phase 4)

Carnets/sections multiples. Éditeur texte riche léger (gras/italique/listes/titres) sérialisé JSON.
Liens internes vers d'autres entités. Recherche.

### 5.6 Transverse (Phase 5)

- **Recherche globale** : index MiniSearch hydraté depuis le cache local, quasi instantané,
  résultats groupés par module, navigation clavier.
- **Rappels + notifications** : FCM (web push) + Cloud Function planifiée scannant les `reminders`
  échus ; notifications navigateur quand l'app est ouverte.
- **Catégories / couleurs / tags** : transverses, éditables.
- **Corbeille** : vue listant les `deletedAt`, restauration + purge.

### 5.7 Durcissement (Phase 6)

Export PDF / impression (feuille de style print + `react-pdf` pour agendas), accessibilité,
budget de perf (ouverture < 3 s, recherche quasi instantanée), suite de tests ciblée
(récurrence, round-trips import/export, rappels, règles métier), audit des Security Rules.

---

## 6. Risques techniques & mitigations

| Risque | Mitigation |
|---|---|
| Firestore NoSQL vs modèle relationnel riche | Dénormalisation par tableaux d'IDs + `array-contains` ; résolution tolérante aux orphelins ; règles de cohérence centralisées dans `core` |
| Pas de full-text Firestore | Index MiniSearch côté client (données utilisateur peu volumineuses) ; bascule Typesense/Algolia si le volume explose |
| Fiabilité des rappels en web | FCM + Cloud Function planifiée (source de vérité serveur) ; le navigateur n'est qu'un canal d'appoint |
| Complexité récurrences (fuseaux, exceptions) | `rrule.js` (RFC 5545) partagé, couvert par tests dédiés ; stockage UTC + affichage fuseau local |
| Sécurité données au repos | Chiffrement at-rest Firestore + Security Rules par `ownerId` (MVP) ; chiffrement de champ E2E en V2 |
| Risque juridique clone visuel | Rétro « esprit » moderne, aucun élément propriétaire repris |

---

## 7. Exigences non fonctionnelles (cibles MVP)

- **Perf** : ouverture < 3 s sur matériel standard ; recherche quasi instantanée ; vues calendrier/listes fluides.
- **Sécurité** : Auth Firebase (email + OAuth), isolation stricte par `ownerId` via Security Rules, chiffrement at-rest.
- **Compatibilité** : import/export ICS, vCard, CSV ; export PDF ; cloud-first multi-appareils.
- **Qualité** : zéro perte de données (soft-delete + corbeille), tests automatisés sur récurrences / import-export / rappels.

---

## 8. Roadmap MVP 1 (phases)

| Phase | Contenu | Sortie vérifiable |
|---|---|---|
| **0 — Fondations** | Monorepo, projet Firebase, Auth, coque rétro 8 onglets, design tokens, couche `core` + repositories, CI | App déployée, login fonctionnel, navigation entre onglets |
| **1 — Contacts** | CRUD, champs multi-valeurs, import/export vCard + CSV | Créer/éditer un contact, round-trip vCard |
| **2 — Calendrier** | Vues jour/semaine/mois/agenda, récurrence, liens contact, ICS | Créer un événement récurrent, l'exporter/importer en ICS |
| **3 — Tâches** | Priorité, échéance, sous-étapes, récurrence, liens | Créer/filtrer/compléter une tâche liée à un contact |
| **4 — Notes** | Carnets/sections, texte riche, liens internes | Créer une note dans un carnet, la lier à un contact |
| **5 — Transverse** | Recherche globale, rappels + notifications, catégories/couleurs/tags, corbeille | Rechercher, recevoir un rappel push, restaurer depuis la corbeille |
| **6 — Durcissement** | Export PDF/print, a11y, perf, tests, audit rules | Suite de tests verte, export PDF d'un agenda, rules auditées |

**V2** : Planner annuel, Journal d'appels, Liens web, app mobile RN, thèmes, chiffrement de champ.
**V3** : collaboration légère, widgets, automatisations, API publique.

---

## 9. Critères de succès (PRD §13)

Création d'événement < 10 s, usage des raccourcis clavier, recherches abouties, rétention J30,
import/export sans erreur, taux de rappels effectivement délivrés.
