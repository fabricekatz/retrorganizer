# Deployment

Retrorganizer is a static React build (Firebase Hosting) backed by Firebase Auth
+ Cloud Firestore. There is no server to run — deploying means: build the web app,
push the static bundle to Hosting, and push the Firestore security rules + indexes.

Two paths are supported and documented below:

- **Manual** — you run `firebase deploy` from your machine. Full control, no secrets.
- **Automated** — `.github/workflows/deploy.yml` deploys on every push to `main`,
  once you've added a service-account secret. It **skips cleanly (green)** until then.

---

## 1. One-time Firebase project setup (console)

You need a **production** Firebase project, separate from the `retrorganizer-dev`
project used by the local emulators.

1. **Create the project** — <https://console.firebase.google.com> → *Add project*
   (e.g. `retrorganizer-prod`). Note the **Project ID**.
2. **Enable Authentication** → *Sign-in method*:
   - **Email/Password** → Enable.
   - **Google** → Enable (set a support email).
3. **Authorized domains** (Authentication → Settings → *Authorized domains*) —
   Google sign-in only works on listed domains. `*.web.app` / `*.firebaseapp.com`
   (your Hosting domains) are added automatically; add any **custom domain** you map.
4. **Create a Web App** — Project settings → *General* → *Your apps* → **Web** (`</>`).
   Copy the SDK config; you'll need `apiKey`, `authDomain`, `projectId`, `appId`.
5. **Create Cloud Firestore** — Firestore Database → *Create database* → start in
   **production mode** (the rules in this repo enforce access; see §5) → pick a region.

---

## 2. Configure the web build

The web app reads its Firebase config from `VITE_*` env vars at **build time**
(see `apps/web/.env.example`). `VITE_USE_EMULATORS` MUST be `false` for production.

**Local production build:**

```bash
cp apps/web/.env.example apps/web/.env.production   # then fill in the real values
# ...edit apps/web/.env.production with the prod Web App config, VITE_USE_EMULATORS=false
pnpm --filter @retrorganizer/web build              # outputs apps/web/dist
```

> Vite picks up `.env.production` automatically for `vite build`. Filled-in env
> files are gitignored; never commit them.

---

## 3. Select the project

The repo's `.firebaserc` defaults to `retrorganizer-dev` (the emulator project).
For a manual deploy, point the CLI at your prod project:

```bash
firebase login
firebase use --add        # choose your prod project, give it the alias "prod"
firebase use prod
```

(The CI workflow instead targets the project explicitly via a repo variable — §4.)

---

## 4. Deploy

### Manual

After building (§2) and selecting the project (§3):

```bash
# Everything (hosting + rules + indexes):
firebase deploy --only hosting,firestore:rules,firestore:indexes

# Or piecemeal:
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

The Hosting URL (`https://<project>.web.app`) is printed on success.

### Automated (GitHub Actions)

`.github/workflows/deploy.yml` runs on push to `main`. It is **gated**: with no
service-account secret it logs a notice and exits green. To enable real deploys,
add these in **GitHub → repo Settings → Secrets and variables → Actions**:

**Secret:**
- `FIREBASE_SERVICE_ACCOUNT` — the JSON key of a service account with deploy rights.
  Generate it: Firebase console → Project settings → *Service accounts* →
  *Generate new private key*. Paste the entire JSON file contents as the secret value.

**Variables** (the public Web App config — not secret, but environment-specific):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`  ← also used as the deploy `--project`
- `VITE_FIREBASE_APP_ID`

Once set, every merge to `main` builds with those variables and deploys hosting +
rules + indexes to `VITE_FIREBASE_PROJECT_ID`. The workflow uses least-privilege
(`permissions: contents: read`), SHA-pinned actions, and a `concurrency` group so
deploys don't race.

> The deploy workflow does not re-run the test suite — CI (`ci.yml`) already gates
> every PR before it reaches `main`.

---

## 5. Firestore rules & indexes

**Rules** (`firestore.rules`) — strict owner isolation on every collection:
- read: authenticated **and** the doc's `ownerId` is the caller (reads of a
  non-existent doc are allowed so `get()` after delete returns null, not an error);
- create: the new doc's `ownerId` must equal the caller;
- update: caller owns the doc **and** can't reassign `ownerId`;
- delete: caller owns the doc.

This is sufficient for a single-user-per-account PIM. **Known limitation:** the
rules validate ownership but not document *shape* (a client could write extra
fields). For a personal app this is acceptable; per-collection field validation is
an optional future hardening, not a deploy blocker.

**Indexes** (`firestore.indexes.json`) — the app's only multi-field reads are
`listByOwner` (equality on `ownerId` + `deletedAt`), which Firestore serves from
single-field indexes. The committed composite indexes cover possible ordered
queries. If a query ever returns a `FAILED_PRECONDITION: The query requires an
index` error in production, the error message includes a one-click link to create
the missing index; add it to `firestore.indexes.json` and redeploy
`--only firestore:indexes`.

---

## 6. Verify & roll back

After deploy:
- Open `https://<project>.web.app`, sign in (Email/Password and Google), and
  exercise a couple of modules (create an event, a task with a reminder).
- Check the browser console for errors and the Firestore console for written docs.

**Rollback** (Hosting keeps prior releases):

```bash
firebase hosting:rollback           # reverts to the previous release
# or roll back to a specific version from the Hosting "Release history" in the console
```

Rules/indexes are versioned in the console (Firestore → Rules → history) and can be
reverted there or by redeploying a prior `firestore.rules` from git.

---

## Quick reference

| Task | Command |
|------|---------|
| Prod build | `pnpm --filter @retrorganizer/web build` (with `.env.production`) |
| Select prod project | `firebase use prod` |
| Full deploy | `firebase deploy --only hosting,firestore:rules,firestore:indexes` |
| Hosting only | `firebase deploy --only hosting` |
| Rollback hosting | `firebase hosting:rollback` |
| Enable CI deploy | add `FIREBASE_SERVICE_ACCOUNT` secret + `VITE_FIREBASE_*` vars |
