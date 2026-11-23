# Architecture de G.E.N.I.S

## Choix techniques (décidés, justifiés)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Interface | **JavaScript natif, modules ES, sans build** | Le site GitHub n'accepte pas l'envoi de dossiers : un dépôt plat chargé tel quel par Pages est le plus robuste. Zéro dépendance, démarrage rapide, ce qui est dans le dépôt est ce qui tourne. React/Vite/TypeScript auraient imposé un build et une arborescence, sans bénéfice pour un seul développeur. La modularité vient des fichiers, pas d'un framework. |
| Application | **PWA** (manifest + service worker) | Une base pour Windows, macOS, Linux, iOS, Android ; installable ; hors ligne partiel. |
| Backend | **Un Cloudflare Worker** (`worker.js`, sans dépendance) | Il faut un endroit pour les secrets, OAuth et les appels refusant le navigateur (CORS). Gratuit, collable dans l'éditeur Cloudflare, ou `wrangler deploy`. Séparation nette : **frontend = GitHub Pages, backend = Worker**. |
| Stockage | **IndexedDB** + cache mémoire synchrone, coffre **AES-GCM** pour les secrets | Plus de 5 Mo (localStorage), lectures synchrones dans l'interface, écritures différées. |
| Voix | **Web Speech API** + moteur neuronal serveur interchangeable | Gratuit et immédiat ; la voix neuronale (OpenAI/ElevenLabs) apporte l'expressivité. Le moteur se change en une fonction (`tts.js › pickEngine`). |
| IA | **Boucle d'outils pilotée par le modèle, exécutée côté navigateur** | La plupart des actions sont locales (ouvrir une page, minuteur, mémoire) ou demandent la confirmation de l'utilisateur : l'exécution doit se faire là où la sécurité s'applique. Le Worker ne fait que relayer le modèle (Claude, ChatGPT, Gemini, format normalisé). |

## Le trajet d'une demande

```
voix / texte ─► brain.runRequest ─► règle utilisateur ? ─► automations.runRule
                      │
                      ├─► nlu-local (commande courante, hors ligne) ─► executor.execute
                      │
                      └─► agents.routeAgents (outils utiles seulement) ─► gateway.chat ─► modèle
                                 ▲                                              │ appels d'outils
                                 └──── résultats réels (status, verified) ◄─────┘ executor.execute
                                                                                  │
                         validation des arguments ─► statut du connecteur ─► security.evaluate
                         ─► permission ? ─► aperçu + confirmation (niveau 3) / authentification forte (niveau 4)
                         ─► capability.run ─► vérification ─► historique des actions
                      │
                 claimGuard : aucune réussite annoncée sans confirmation réelle ─► réponse + voix + cartes
```

Le même trajet sert le texte et la voix (même contexte) et les automatisations (sans jamais contourner les confirmations : en l'absence de l'utilisateur, une action de niveau 3 attend dans les notifications, une action de niveau 4 n'est jamais exécutée).

## Un connecteur = un fichier

```js
// connector-spotify.js  (+ une ligne dans MODULES de connectors.js — rien d'autre)
import { ok, fail, manual } from './connectors.js';
export default {
  id: 'spotify', name: 'Spotify', icon: 'music', category: 'Musique', agent: 'media',
  auth: { type: 'oauth2', provider: 'Spotify' },
  status: () => (connecté ? 'ready' : { state: 'needs_auth', detail: 'Connectez Spotify dans Réglages.' }),
  limits: ['Lecture : Spotify Premium requis pour piloter la lecture.'],
  capabilities: {
    play: { label: 'Lancer sur Spotify', description: '…', level: 1, permission: 'media.control',
            params: { query: { type: 'string' } }, required: ['query'],
            run: async ({ query }, ctx) => ok('Lecture lancée.', { /* … */ }) }
  }
};
```

Un connecteur déclare : **capacités, permissions, authentification, actions, limites, erreurs**. Il retourne toujours un résultat normalisé : `status` (`done`, `unverified`, `needs_manual`, `needs_config`, `needs_auth`, `needs_confirmation`, `denied`, `cancelled`, `failed`) et `verified` (vrai seulement si le service ou une mesure locale confirme). Une action de niveau ≥ 3 dont le succès n'est pas vérifié est automatiquement rétrogradée en `unverified`. Les connecteurs « préparés » (`connectors-prepared.js`) n'exposent **aucun outil** : l'IA ne peut donc pas prétendre les utiliser.

## Sécurité en couches (détails : `SECURITY.md`)

Niveau 1 lecture · 2 préparation · 3 action (confirmation, configurable par permission) · 4 action sensible (phrase secrète + deux touches maintenues, toujours). Le modèle ne peut ni contourner la politique, ni fabriquer un jeton d'authentification forte (jetons à usage unique émis uniquement par le flux d'interface), ni recevoir un secret (`sanitizeForModel`). Les contenus venus d'outils, de pages, de mails, de documents et de la mémoire sont marqués « données non fiables ».

## Mémoire et historique

`memory.js` : souvenirs typés (préférence, information, projet, tâche, habitude, lieu, important, style), importance, épinglage, source (utilisateur / appris), quotas (300 souvenirs, 1 200 caractères chacun, 600 messages par conversation). Recherche pondérée (BM25 simplifié, accents ignorés, récence). « Hier », « lundi dernier » → rappel par date. « Comme la dernière fois » → dernières actions réussies (arguments conservés). Les habitudes observées 3 fois sont **proposées**, jamais retenues sans accord (sauf mode « automatique » choisi). Tout est visible, modifiable, supprimable dans le panneau Mémoire.

## Voix et onde

`tts.js` : `cleanForSpeech` → `planProsody` (rythme, hauteur, pauses selon info / réussite / confirmation / erreur / urgence) → moteur (`browser` ou `gateway`). L'onde (`waveform.js`) reçoit un spectre : réel (AnalyserNode) pour le micro et la voix neuronale, simulé à partir des événements de mots pour la voix du navigateur (qui n'expose pas son audio). États : veille, écoute, compréhension, réflexion, réponse, erreur, confirmation ; le micro coupé est visuellement distinct (forme plus petite et atténuée, pastille « Micro coupé ») et le flux audio est réellement fermé.

## Multitâche

`spaces.js` : chaque espace a sa conversation, son statut et son exécution (plusieurs tournent en parallèle). Onglets en haut, vue d'ensemble (`Ctrl/Cmd+K`), lecteur Deezer global persistant.

## Performance

Une seule animation canvas (ressorts amortis, un `Path2D` par image, qualité adaptative si les images dépassent ~26 ms, pause si l'onglet est masqué, réduction automatique avec « animations réduites »), modules préchargés (`modulepreload`), bibliothèques lourdes (PDF, Office, OCR) chargées à la demande, aucune dépendance.

## Évolutions prévues (l'architecture ne les bloque pas)

Streaming des réponses (voix dès la première phrase), notifications Push (Worker + VAPID) pour les réveils app fermée, Home Assistant, agent navigateur local pour les sites sans API, application native (la logique est découplée de l'interface), mémoire longue durée résumée, connecteurs Outlook/Slack/SNCF/banque (déjà déclarés).
