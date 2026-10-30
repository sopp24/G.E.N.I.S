# GENIS

**G.E.N.I.S — Gestionnaire d'Environnement Numérique Intégré et Synchronisé**

> Je demande. GENIS s'en occupe.

GENIS est un assistant personnel web installable (PWA), avec interface vocale et textuelle, mémoire locale, historique, outils IA contrôlés et architecture modulaire de connecteurs.

## Architecture

Frontend statique à la racine du dépôt, hébergé par GitHub Pages. Passerelle IA séparée sous Cloudflare Workers pour garder les clés fournisseurs côté serveur. JavaScript ES modules sans framework lourd : chargement rapide, peu de dépendances et déploiement statique simple.

## Fonctions réellement disponibles

- Interface sombre, responsive, onde audio centrale et dock.
- Reconnaissance vocale via Web Speech API (selon navigateur) et synthèse vocale native.
- Conversation généraliste via Anthropic ou OpenAI, avec contexte et souvenirs facultatifs.
- Appels d'outils côté Worker : heure locale/fuseau horaire, calculatrice sécurisée sans eval, météo Open-Meteo et recherche Wikipédia.
- Trace visible des outils utilisés dans la réponse.
- Historique local avec recherche plein texte, conversations réouvrables et export JSON.
- Mémoire locale consultable, modifiable et supprimable.
- Minuteurs et rappels locaux ; ils ne sont pas garantis si le navigateur ferme/suspend l'application.
- Météo Open-Meteo, géolocalisation uniquement après autorisation.
- Analyse locale de TXT, MD, CSV, JSON, HTML, XML, code, PDF, DOCX, XLSX/XLS, PPTX et images (OCR français/anglais). Permission Fichiers requise ; limite de 12 Mo/fichier. Les bibliothèques PDF/Office/OCR sont chargées depuis des CDN lors de leur première utilisation.
- Automatisations locales simples par phrase déclencheuse : réponse, ouverture de service ou minuteur.
- Notifications navigateur si la permission est accordée et si l'application reste active.
- Ouverture préparée des services web courants.
- PWA, cache de la coque et installation sur l'écran d'accueil.
- Workflow GitHub Actions de vérification syntaxique et des ressources.

## Outils IA et limites de sécurité

Le Worker expose seulement quatre outils : heure, calculatrice, météo et recherche Wikipédia. Il limite les boucles d'outils à cinq étapes. Aucun outil d'envoi d'e-mail, de modification d'agenda, d'achat, de réservation, de paiement, de virement, de contrôle domotique ou de modification de compte n'est exposé au modèle. Ces intégrations restent préparées dans `index.js` et exigent des APIs officielles, OAuth et des permissions serveur.

GENIS ne doit jamais annoncer une action externe comme réussie sans confirmation réelle du service. Les résultats Wikipédia sont encyclopédiques, pas une recherche exhaustive du web.

## Installation locale

Aucun build frontend n'est nécessaire :

```bash
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080`. Microphone, PWA et notifications exigent généralement HTTPS ou localhost.

## GitHub Pages

1. Déposer les fichiers frontend à la racine du dépôt.
2. Dans **Settings → Pages**, choisir **Deploy from a branch**.
3. Sélectionner `main` et `/(root)`.
4. La publication se fait automatiquement après les commits.

L'origine CORS du projet est `https://sopp24.github.io` (le chemin du dépôt n'est pas inclus dans l'origine).

## Déployer la passerelle Cloudflare

Le fichier `worker.js` est autonome et son déploiement est préparé par `wrangler.toml`.

1. Installer Wrangler / s'authentifier : `npx wrangler login`.
2. Définir le secret partagé : `npx wrangler secret put APP_SECRET`.
3. Définir une clé fournisseur : `npx wrangler secret put ANTHROPIC_API_KEY` ou `npx wrangler secret put OPENAI_API_KEY`.
4. Régler `AI_PROVIDER` dans `wrangler.toml` sur `anthropic` ou `openai`.
5. Vérifier `ALLOWED_ORIGIN` (origine exacte de GitHub Pages).
6. Déployer : `npx wrangler deploy`.
7. Dans GENIS → Réglages → Connexion IA, choisir le même fournisseur, coller l'URL du Worker et le secret partagé.

Modèles par défaut : `claude-haiku-4-5-20251001` et `gpt-4.1-mini`. Le compte fournisseur doit être approvisionné. GitHub Pages ne fournit pas lui-même un modèle IA gratuit.

## Fichiers et confidentialité

Les fichiers sont extraits localement dans le navigateur. Leur texte n'est transmis au fournisseur IA que lorsque l'utilisateur envoie explicitement un message avec ces pièces jointes. Les souvenirs sélectionnés sont ajoutés au contexte envoyé au fournisseur. Ne mémorisez ni ne joignez des informations que vous ne souhaitez pas lui transmettre.

Le secret partagé est conservé dans le stockage local du navigateur : ce n'est pas un coffre-fort. Ne partagez pas cet appareil/profil de navigateur. Les clés API fournisseurs restent uniquement dans les secrets Cloudflare.

## Qualité

`npm test` vérifie la syntaxe JavaScript. GitHub Actions exécute également les contrôles du manifest PWA et la présence des ressources frontend à chaque push / pull request sur `main`.

## Limites techniques

- Les APIs vocales dépendent du navigateur et de la langue installée.
- Le chargement initial des bibliothèques PDF/Office/OCR nécessite Internet.
- Les outils IA nécessitent le Worker et une clé API valide.
- La PWA ne peut pas librement piloter les applications natives ou les comptes sans API/OAuth.
- Les rappels et notifications locaux ne constituent pas un service d'exécution permanent en arrière-plan.
- Les connecteurs Google, Gmail/Outlook, Deezer, SNCF, Vinted, Doctolib, Pronote, BNP, domotique, SOPP Language et Pharma SOPP sont préparés, mais ne sont pas présentés comme connectés.
- Paiements et opérations bancaires restent désactivés.

## Philosophie

GENIS masque la complexité technique, mais reste transparente sur les outils utilisés, les autorisations nécessaires et les limites réelles. L'interface et la direction artistique existantes sont conservées.
