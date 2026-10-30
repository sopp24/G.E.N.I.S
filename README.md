# GENIS

**G.E.N.I.S — Gestionnaire d'Environnement Numérique Intégré et Synchronisé**

> Je demande. GENIS s'en occupe.

GENIS est un assistant personnel web installable (PWA), avec interface vocale et textuelle, mémoire locale, historique, outils IA contrôlés et architecture modulaire de connecteurs.

## Architecture

Frontend statique à la racine du dépôt, hébergé par GitHub Pages. Passerelle IA séparée sous Cloudflare Workers pour garder les clés fournisseurs côté serveur. JavaScript ES modules sans framework lourd : chargement rapide, peu de dépendances et déploiement statique simple.

## Fonctions réellement disponibles

- Interface sombre, responsive, onde centrale et dock. L'onde réagit au niveau du microphone ; pendant la synthèse vocale native, elle affiche un état animé mais ne récupère pas le flux audio de sortie du système.
- Reconnaissance vocale via Web Speech API (selon navigateur) et synthèse vocale native avec sélection des voix françaises disponibles sur l'appareil.
- Conversation généraliste via Anthropic ou OpenAI, avec contexte et souvenirs facultatifs.
- Appels d'outils côté Worker : heure locale/fuseau horaire, calculatrice sécurisée sans eval, météo Open-Meteo et recherche Wikipédia.
- Trace visible des outils utilisés dans la réponse.
- Historique local complet avec recherche plein texte sur toutes les conversations, conversations réouvrables et export JSON.
- Rappel contextuel : lors d'une demande explicite sur une ancienne discussion, GENIS retrouve quelques extraits pertinents dans les autres conversations locales.
- Mémoire locale consultable, modifiable et supprimable.
- Minuteurs et rappels locaux ; ils ne sont pas garantis si le navigateur ferme/suspend l'application.
- Météo Open-Meteo, géolocalisation uniquement après autorisation.
- Analyse locale de TXT, MD, CSV, JSON, HTML, XML, code, PDF à texte intégré (80 pages maximum), DOCX, XLSX/XLS, PPTX et images (OCR français/anglais). Les PDF scannés sans couche texte ne sont pas OCRisés automatiquement. Permission Fichiers requise ; limite de 12 Mo/fichier et 48 000 caractères cumulés transmis au modèle par demande. Les bibliothèques PDF/Office/OCR sont chargées depuis des CDN lors de leur première utilisation.
- Automatisations locales par phrase déclencheuse : création, modification du déclencheur, ajout/modification/retrait d'actions multiples, activation et suppression. Actions prises en charge : réponse, ouverture de service ou minuteur. Les déclencheurs temporels/événementiels et l'exécution garantie en arrière-plan ne sont pas disponibles dans une PWA statique.
- Notifications navigateur si la permission est accordée et si l'application reste active.
- Ouverture préparée des services web courants.
- PWA, cache de la coque et installation sur l'écran d'accueil.
- Workflow GitHub Actions de vérification syntaxique et des ressources.

## Outils IA et limites de sécurité

Le Worker expose seulement quatre outils : heure, calculatrice, météo et recherche Wikipédia. Il limite les boucles d'outils à cinq étapes. Aucun outil d'envoi d'e-mail, de modification d'agenda, d'achat, de réservation, de paiement, de virement, de contrôle domotique ou de modification de compte n'est exposé au modèle. Ces intégrations restent préparées dans `index.js` et exigent des APIs officielles, OAuth et des permissions serveur.

GENIS ne doit jamais annoncer une action externe comme réussie sans confirmation réelle du service. Les résultats Wikipédia sont encyclopédiques, pas une recherche exhaustive du web. La recherche Google ouvre un onglet externe ; GENIS n'en lit pas ni ne résume automatiquement le contenu.

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
7. Dans GENIS → Réglages → Connexion IA, choisir le même fournisseur, coller l'URL du Worker et le secret partagé. Utiliser ensuite **Tester la connexion** : GENIS vérifie l'URL, la présence d'`APP_SECRET`, sa correspondance avec le navigateur et la présence de la clé API avant de lancer un véritable test IA.

Modèles par défaut : `claude-haiku-4-5-20251001` et `gpt-4.1-mini`. Le compte fournisseur doit être approvisionné. GitHub Pages ne fournit pas lui-même un modèle IA gratuit. Après toute modification de `worker.js`, il faut redéployer ce fichier sur Cloudflare : le déploiement GitHub Pages ne publie pas le Worker.

## Fichiers et confidentialité

Les fichiers sont extraits localement dans le navigateur. Leur texte n'est transmis au fournisseur IA que lorsque l'utilisateur envoie explicitement un message avec ces pièces jointes. Le texte des pièces jointes transmis au modèle est limité à 48 000 caractères cumulés par demande. Les souvenirs sélectionnés sont ajoutés au contexte envoyé au fournisseur. Lorsqu'une demande évoque clairement une discussion passée, quelques extraits pertinents sont recherchés dans l'historique local et transmis au fournisseur pour reconstituer le contexte. Ne mémorisez ni ne joignez des informations que vous ne souhaitez pas lui transmettre.

Le secret partagé est conservé dans le stockage local du navigateur : ce n'est pas un coffre-fort. Ne partagez pas cet appareil/profil de navigateur. Les clés API fournisseurs restent uniquement dans les secrets Cloudflare.

## Qualité

`npm test` vérifie la syntaxe JavaScript. GitHub Actions contrôle également le manifest PWA, les ressources, les sélecteurs DOM utilisés en collection, les branchements de la voix et des fichiers, et exécute des tests Worker simulant des appels d'outils Anthropic et OpenAI, les erreurs d'authentification et les limites de taille.

## Limites techniques

- Les APIs vocales dépendent du navigateur et de la langue installée. Le choix d'une voix dépend des voix de synthèse réellement proposées par l'appareil.
- Le chargement initial des bibliothèques PDF/Office/OCR nécessite Internet.
- Les outils IA nécessitent le Worker et une clé API valide.
- La PWA ne peut pas librement piloter les applications natives ou les comptes sans API/OAuth.
- Les rappels et notifications locaux ne constituent pas un service d'exécution permanent en arrière-plan. Les automatisations déclenchées par phrase ne se déclenchent que lorsque GENIS est ouverte et que l'utilisateur lui adresse la phrase.
- Les connecteurs Google, Gmail/Outlook, Deezer, SNCF, Vinted, Doctolib, Pronote, BNP, domotique, SOPP Language et Pharma SOPP sont préparés, mais ne sont pas présentés comme connectés.
- Paiements et opérations bancaires restent désactivés.

## Philosophie

GENIS masque la complexité technique, mais reste transparente sur les outils utilisés, les autorisations nécessaires et les limites réelles. L'interface et la direction artistique existantes sont conservées.
