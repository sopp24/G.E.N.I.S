# G.E.N.I.S

**Gestionnaire d'Environnement Numérique Intégré et Synchronisé** — l'assistant personnel qui fait les choses à votre place.

> *Je demande. G.E.N.I.S s'en occupe.*

G.E.N.I.S n'est pas un chatbot : c'est un **orchestrateur**. Vous parlez ou vous écrivez ; elle comprend l'intention, choisit les bons outils, agit, demande une confirmation quand la sécurité l'exige, **vérifie** que l'action a réellement eu lieu, puis vous répond. Une action qu'elle ne peut pas faire, elle le dit (« Je peux préparer la recherche, pas lire les résultats : veux-tu que j'ouvre la page ? ») — **rien n'est simulé**.

C'est une application web installable (PWA) : ordinateur, téléphone, tablette. Une interface noire, une onde blanche vivante au centre qui réagit à la voix, un dock permanent.

---

## Démarrer en 10 minutes

### 1. Publier l'interface (GitHub Pages)

Le dépôt est **plat** (aucun dossier) pour pouvoir être envoyé depuis le site GitHub, sans outil.

1. Décompressez l'archive, puis sur `github.com/sopp24/G.E.N.I.S` : **Add file › Upload files** et glissez **tous les fichiers** (pas le dossier lui-même). Validez (*Commit changes*).
2. **Settings › Pages › Build and deployment** : *Source* = **Deploy from a branch**, branche **main**, dossier **/ (root)**.
3. Au bout d'une minute : `https://sopp24.github.io/G.E.N.I.S/`. Ouvrez-la ; installez-la (menu du navigateur › *Installer l'application*, ou sur iPhone/iPad *Partager › Sur l'écran d'accueil*).
4. *Facultatif* : les vérifications automatiques. Aucun workflow GitHub Actions n'est inclus dans ce dépôt plat (il exigerait un dossier `.github/workflows/`) ; `npm run verify` exécute les mêmes contrôles en local. Les fichiers commençant par un point (`.gitignore`, `.dev.vars.example`) peuvent être masqués par votre système : ils sont bien dans le dépôt.

Sans rien d'autre, G.E.N.I.S fonctionne déjà : minuteurs, rappels, réveils, calculs, météo, itinéraires, Wikipédia, mémoire, historique, automatisations, espaces de travail, lecture de pièces jointes. Les demandes complexes (« organise mon week-end à Lyon ») demandent une IA : étape suivante.

### 2. Brancher la passerelle (recommandé)

La **passerelle** (`worker.js`, un Cloudflare Worker gratuit) garde vos clés secrètes — le navigateur n'en détient aucune — et relaie l'IA, la voix neuronale, les actualités, Deezer et Google.

1. Compte gratuit sur cloudflare.com › **Workers & Pages › Create › Hello World**, nommez-le `genis-gateway`, *Deploy*, puis **Edit code**, remplacez tout par le contenu de `worker.js`, *Deploy*. (Ou, avec Node : `npx wrangler login` puis `npm run worker:deploy`.)
2. **Settings › Variables and Secrets** : ajoutez les valeurs du tableau ci-dessous. Minimum : `APP_SECRET` (une longue phrase aléatoire, en *Secret*), `ALLOWED_ORIGIN` = `https://sopp24.github.io` (en *Text*), et **une** clé d'IA (`ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`, en *Secret*).
3. Dans G.E.N.I.S : **Réglages › Passerelle IA** : collez l'adresse du Worker (`https://genis-gateway.<vous>.workers.dev`) et le `APP_SECRET`, puis **Tester la connexion**.

| Variable | Type | Rôle |
|---|---|---|
| `APP_SECRET` | secret, **obligatoire** | Secret partagé avec l'application (il protège toutes les routes) |
| `ALLOWED_ORIGIN` | texte, **obligatoire** | Origine(s) autorisée(s), ex. `https://sopp24.github.io` (sans chemin, séparées par des virgules) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | secret | Au moins une. Gemini est expérimental |
| `AI_PROVIDER` | texte | `anthropic` (défaut), `openai` ou `gemini` |
| `MODEL_ANTHROPIC_FAST` / `_SMART`, `MODEL_OPENAI_*`, `MODEL_GEMINI_*` | texte | Remplacent les modèles par défaut (rapide pour les demandes simples, avancé pour les tâches complexes) |
| `OPENAI_TTS_VOICE`, `OPENAI_TTS_MODEL`, `OPENAI_STT_MODEL` | texte | Voix neuronale et transcription via OpenAI (la clé OpenAI suffit) |
| `ELEVENLABS_API_KEY` (secret), `ELEVENLABS_VOICE_ID`, `TTS_PROVIDER` | | Voix ElevenLabs à la place d'OpenAI |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY` + KV `GENIS_KV` | | Agenda et Gmail (voir ci-dessous) |
| `NEWS_FEEDS` | JSON | Remplace/étend les flux d'actualité : `{"lemonde":["https://…"]}` |

**Google Agenda / Gmail** (facultatif) : console.cloud.google.com › nouveau projet › activer *Google Calendar API* et *Gmail API* › *Écran de consentement OAuth* (externe ; **passez-le en « Production »** sinon Google invalide la connexion au bout de 7 jours) › *Identifiants › ID client OAuth › Application Web*, URI de redirection autorisée : `https://genis-gateway.<vous>.workers.dev/oauth/google/callback`. Créez un espace KV (`npx wrangler kv namespace create GENIS_KV`) et liez-le au Worker sous le nom `GENIS_KV`, ajoutez `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `TOKEN_ENC_KEY` (longue phrase aléatoire). Puis **Réglages › Comptes connectés › Connecter Google**. Vous choisissez les permissions ; vous pouvez les révoquer à tout moment.

### 3. Parler à G.E.N.I.S

Touchez le micro sous l'onde (ou `Alt+M`), ou écrivez dans la barre du bas. Exemples : *« Mets un minuteur de 10 minutes »*, *« Quelle est la météo demain à Lyon ? »*, *« Mets du R&B »*, *« Réveille-moi à 7h30 »*, *« Itinéraire de Paris à Lyon en train »*, *« Quand je dis bonne nuit, mets ma playlist de nuit »*, *« Organise-moi une semaine à Athènes avec 1 500 € »*.

Raccourcis : `Alt+M` micro · `/` saisie · `Ctrl/Cmd+K` vue d'ensemble des espaces · `Alt+1…8` changer d'espace · `Échap` interrompre ou fermer.

---

## Mise à jour depuis la version précédente

Envoyez tous les fichiers de l'archive (ils remplacent ceux du même nom). **Supprimez** ensuite ces fichiers devenus inutiles (ouvrir le fichier › icône corbeille › *Commit*) : `index.html.orig`, `index.js`, `tools.js`, `README-ARCHITECTURE.md`. **Redéployez `worker.js`** (la nouvelle interface détecte une ancienne passerelle et vous le dit). Vos conversations, souvenirs, règles et le secret de la passerelle sont migrés automatiquement au premier lancement ; le secret passe dans un coffre chiffré et est retiré du stockage en clair.

---

## Développement

```bash
npm install          # outils de test uniquement : l'application n'a aucune dépendance
npm run serve        # http://localhost:8080 (ou : python3 -m http.server 8080)
npm run verify       # syntaxe + 17 tests (métier, sécurité, passerelle) + test de fumée de l'interface
npm run worker:dev   # passerelle en local (copiez .dev.vars.example en .dev.vars)
```

Il n'y a **pas d'étape de build** : ce que vous voyez dans le dépôt est exactement ce que le navigateur charge. Après avoir ajouté ou renommé un fichier `.js`, ajoutez-le à la liste `SHELL` de `sw.js` (un test vous prévient si vous l'oubliez) et changez `VERSION` pour forcer la mise à jour du cache.

## Où se trouve quoi

| Rôle | Fichiers |
|---|---|
| Interface | `index.html`, `styles.css`, `ui.js`, `panels.js`, `cards.js`, `modals.js`, `waveform.js`, `app.js` |
| Voix | `voice.js` (écoute), `tts.js` (voix : prosodie + moteurs interchangeables), `audio.js` |
| Cerveau | `brain.js` (orchestrateur), `nlu-local.js` (compréhension hors ligne), `agents.js`, `datetime-fr.js` |
| Sécurité | `permissions.js`, `security.js` (niveaux 1–4), `executor.js`, `strong-auth.js`, `vault.js`, `sopp-gate.js` (verrou d'accès SOPP Agents) |
| Données | `storage.js`, `memory.js`, `spaces.js`, `legacy.js` |
| Automatisation | `automations.js`, `scheduler.js`, `notifications.js` |
| Connecteurs | `connectors.js` (registre), `connector-*.js` (un par service), `connectors-prepared.js`, `services.js`, `geo.js`, `files.js`, `gateway.js` |
| Passerelle | `worker.js`, `wrangler.toml`, `.dev.vars.example` |
| PWA | `manifest.webmanifest`, `sw.js`, `favicon.svg`, `genis-*.png`, `apple-touch-icon.png` |
| Qualité | `test.mjs`, `smoke.mjs`, `check.mjs`, `package.json` |
| Docs | `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `INTEGRATIONS.md`, `FEATURES.md` |

## Verrouillage d'accès

Cette application est conçue pour être ouverte **depuis SOPP Agents** (<https://sopp24.github.io/SOPP-agents/>), qui se déverrouille par Face ID / Touch ID puis ouvre l'application avec un jeton dans le fragment d'URL. Un accès direct affiche un écran de verrouillage (« Ouvrir SOPP Agents ») ; le verrou est assuré par `sopp-gate.js`, chargé en premier dans `index.html`. Il est ignoré sur `localhost`, `127.0.0.1` et `file:` pour le développement et les tests (`?soppgate=force` force son activation). Le paramètre `?from=sopp-agents` et le bouton de retour vers SOPP Agents ne sont pas modifiés.

Limite à connaître : un dépôt statique public ne peut pas cacher son code. Ce verrou empêche l'usage normal en dehors de SOPP Agents, pas la lecture des fichiers ; une vraie protection demande un dépôt privé servi derrière le Worker authentifié (voir `SOPP-agents/cloudflare-auth`).

Licence : tous droits réservés (voir `LICENSE`).

## Limites connues (dites sans détour)

- **Testé** : toute la logique avec des simulations réseau (dates, mémoire, sécurité, exécuteur, orchestrateur, passerelle, OAuth) et l'interface complète dans un DOM simulé. **Non testé en conditions réelles** : les appels vers les services tiers (Anthropic, OpenAI, Gemini, ElevenLabs, Google, Deezer, Open-Meteo, OpenStreetMap, flux RSS) et le rendu sur de vrais appareils. Les premiers essais révéleront peut-être des ajustements (formats de flux, noms de modèles, etc.).
- Une PWA **ne se réveille pas toute seule** : minuteurs et réveils sonnent tant que G.E.N.I.S est ouverte. Pour un réveil fiable, utilisez l'export `.ics` vers l'agenda de l'appareil.
- Le micro et la reconnaissance vocale dépendent du navigateur (sur Chrome, l'audio est traité par le service du navigateur). Sur iPhone, l'écoute continue est limitée par iOS.
- Vinted, Leboncoin, Amazon, Doctolib, Ameli, Pronote, Netflix… n'ont **pas d'API publique** : G.E.N.I.S prépare et ouvre, elle ne lit ni n'achète à votre place. Voir `INTEGRATIONS.md`.
- Aucun paiement réel n'est branché : l'authentification forte est prête, mais « payer » n'existe pas encore comme action.
- Toutes les apps hébergées sur `sopp24.github.io` **partagent la même origine navigateur** : voir `SECURITY.md` (recommandation d'isolation).
