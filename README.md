# GENIS

**G.E.N.I.S — Gestionnaire d'Environnement Numérique Intégré et Synchronisé**

> Je demande. GENIS s'en occupe.

GENIS est conçu comme un assistant personnel universel : une interface vocale et textuelle capable d'orchestrer des outils, de conserver un contexte local, d'exécuter des fonctions locales et d'appeler des connecteurs lorsque ceux-ci sont réellement configurés.

## Architecture choisie

GENIS utilise un **frontend PWA statique** hébergeable sur GitHub Pages + une **passerelle IA facultative** sous forme de Cloudflare Worker. Ce choix respecte la contrainte de déploiement simple tout en évitant de placer une clé API dans le navigateur. GitHub Pages sert des fichiers statiques ; la passerelle protège les secrets côté serveur.

Le cœur est en JavaScript ES modules sans framework lourd : cela réduit le temps de chargement, facilite le déploiement statique et laisse une trajectoire claire vers une application native plus tard.

### Structure

```text
GENIS/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── .nojekyll
├── .gitignore
├── worker.js
├── brain.js
├── storage.js
├── voice.js
├── waveform.js
├── tools.js
├── index.js
├── genis-192.png
├── genis-512.png
└── .github/workflows/deploy.yml
```

## Ce qui fonctionne dans cette première version

- Interface GENIS noire, minimaliste et responsive.
- Onde centrale animée via Canvas, réactive au niveau audio lorsque le microphone est autorisé.
- Reconnaissance vocale via Web Speech API lorsqu'elle est proposée par le navigateur.
- Synthèse vocale via SpeechSynthesis.
- Conversation texte et voix partagée.
- Historique local des conversations.
- Mémoire locale visible/modifiable/supprimable.
- Minuteurs locaux.
- Météo via Open-Meteo, avec géolocalisation facultative.
- Ouverture préparée des services courants (Deezer, YouTube, Gmail, Agenda, SNCF, Vinted, etc.) sans prétendre contrôler les comptes.
- Recherche web ouverte dans un nouvel onglet, sans prétendre avoir analysé les résultats.
- Notifications navigateur quand la permission existe.
- Paramétrage du microphone, de la voix, des permissions et de la passerelle IA.
- PWA + service worker + installation écran d'accueil.
- Passerelle Anthropic Cloudflare Worker prête à déployer.

## Ce qui est préparé mais pas présenté comme fonctionnel

Les connecteurs Google, Gmail/Outlook, Deezer, SNCF, Vinted, Doctolib, Pronote, BNP, maison connectée, SOPP Language et Pharma SOPP sont décrits dans `index.js`. Ils nécessitent des APIs officielles, OAuth, des URLs réelles ou des intégrations supplémentaires. GENIS ne simule pas leur exécution.

Les domaines banque, santé, fichiers sensibles, domotique et paiements restent protégés à haut niveau de risque. Aucun paiement n'est déclenché par la version fournie.

## Installation locale

Aucun build n'est obligatoire : c'est volontairement un site statique.

Depuis le dossier du projet :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

La PWA, le microphone et la synthèse vocale doivent être testés dans un contexte sécurisé (`https://`) ou `localhost`, selon les APIs du navigateur.

## GitHub Pages

1. Créez un dépôt GitHub.
2. Copiez le contenu de ce dossier dans la racine du dépôt.
3. Poussez la branche `main`.
4. Dans **Settings → Pages**, choisissez **GitHub Actions**.
5. Le workflow `.github/workflows/deploy.yml` publie automatiquement les fichiers statiques.

La page GitHub est publique dès qu'elle est publiée ; ne placez donc aucun secret, mot de passe ou fichier privé dans le dépôt.

## Passerelle IA sécurisée

Le navigateur ne reçoit jamais la clé Anthropic. Le fichier `worker.js` est destiné à Cloudflare Workers.

Variables/secrets à créer dans Cloudflare :

- `ANTHROPIC_API_KEY` — **Secret**, obligatoire.
- `APP_SECRET` — **Secret**, facultatif mais conseillé pour filtrer les appels de la passerelle.
- `ALLOWED_ORIGIN` — variable, par exemple `https://votre-compte.github.io`.

Après déploiement du Worker :

**GENIS → Réglages → Connexion IA → URL de la passerelle**

Puis enregistrer et utiliser **Tester la connexion**.

> Le secret `APP_SECRET` est un filtre applicatif, pas une protection cryptographique absolue. La vraie protection du compte reste la gestion des secrets, le contrôle d'accès et les limites de dépense côté fournisseur.

## Variables d'environnement

Le frontend statique n'utilise volontairement aucune variable `.env`. Les secrets appartiennent au backend Cloudflare. Le navigateur stocke seulement l'URL de la passerelle et, si l'utilisateur le choisit, le secret partagé local destiné à cette passerelle.

## Modèle de sécurité

GENIS distingue conceptuellement :

1. **Lecture** — météo, heure, recherche.
2. **Préparation** — préparer une réservation, un mail, un panier.
3. **Action** — envoyer, modifier, réserver.
4. **Action sensible** — paiement, virement, suppression définitive, domotique critique.

La prochaine étape consiste à transformer cette grille en moteur de politiques côté serveur, avec confirmation et authentification adaptées au service ciblé.

## Notes techniques et limites

- Une PWA web ne peut pas librement contrôler toutes les applications natives ou tous les comptes. Les intégrations doivent passer par des APIs officielles, OAuth ou des capacités explicitement exposées par le navigateur.
- La reconnaissance vocale dépend du navigateur et de sa disponibilité.
- Le service worker permet le chargement de la coque hors connexion, mais les traductions, le modèle IA et la météo nécessitent une connexion.
- Les actions réellement effectuées doivent être confirmées par la réponse du service connecté ; GENIS ne doit pas afficher une réussite uniquement parce qu'elle a lancé une requête.
- Pour un assistant réellement permanent en arrière-plan, une application native ou un service système sera nécessaire à terme.

## Prochaine trajectoire

**Phase 1 :** cœur GENIS, voix, texte, onde, mémoire, tâches locales, connecteurs préparés, sécurité et PWA.

**Phase 2 :** OAuth et connecteurs réels (Google en priorité), automatisations et multitâche persistant.

**Phase 3 :** achats/réservations avancés, maison connectée, contrôle système et sécurité forte.

## Philosophie produit

GENIS doit cacher la complexité technique à l'utilisateur, tout en restant transparente sur ce qu'elle fait, le service utilisé, les permissions nécessaires et les limites réelles de chaque action.
