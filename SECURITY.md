# Sécurité de G.E.N.I.S

G.E.N.I.S peut toucher à vos mails, agenda, achats, fichiers, musique, maison, banque. La sécurité est donc dans la conception, pas ajoutée après.

## Règles absolues

- **Aucun secret dans le code ni dans le dépôt.** Les clés vivent dans les secrets du Worker (`wrangler secret put`). Le navigateur ne détient aucune clé de fournisseur.
- **Aucun jeton affiché, jamais.** Les jetons OAuth restent chiffrés (AES-GCM) dans le KV du Worker.
- **Aucun identifiant envoyé au modèle.** Les résultats d'outils passent par `sanitizeForModel` (supprime les clés `token`, `secret`, `password`, `api_key`, `authorization`…). La phrase secrète n'entre jamais dans le fil de discussion.
- **Aucune réussite simulée.** Chaque résultat porte `status` et `verified` ; la « garde d'affirmations » ajoute une précision si le texte annonce une réservation, un envoi, un achat, une modification d'agenda ou une suppression sans confirmation réelle.

## Les quatre niveaux

| Niveau | Exemples | Comportement |
|---|---|---|
| 1 Lecture | météo, lire l'agenda, chercher un produit | Exécution directe (après la permission, une fois) |
| 2 Préparation | brouillon de mail, recherche d'achat, planning de voyage | Exécution directe : ne produit aucun effet extérieur |
| 3 Action | envoyer un mail, ajouter un événement, écrire un fichier, créer une automatisation | **Confirmation** avec les paramètres réels et le pourquoi ; configurable par permission (« sans confirmation ») ; confirmation vocale optionnelle |
| 4 Action sensible | paiement, virement, suppression définitive, serrure/alarme, effacer les données | **Authentification forte obligatoire**, non désactivable, jamais en arrière-plan, jamais à la voix seule |

Autres garde-fous : interprétation ambiguë ⇒ confirmation même au niveau 3 ; une automatisation ne peut contenir aucune action de niveau 4 ; si vous êtes absent, une action de niveau 3 est mise en attente dans les notifications.

## Authentification forte (paiements et actions sensibles)

**Phrase secrète** (≥ 14 caractères, ≥ 3 mots ; saisie ou dictée) **+ deux touches maintenues 1,2 s** (par défaut Ctrl gauche + Maj gauche ; pastilles tactiles sur mobile). Seuls les événements clavier réels (`isTrusted`) comptent : un script qui simule des touches échoue.

- La phrase n'est **jamais stockée, affichée ni envoyée à une IA** ; seul un dérivé PBKDF2-SHA-256 (310 000 itérations, sel aléatoire) est conservé. La comparaison se fait à temps constant.
- Tolérance de dictée : casse, accents et ponctuation sont ignorés avant le calcul.
- Verrouillage progressif après 3 échecs (30 s, puis ×2, plafonné à 15 min).
- **Récupération** : un code à 12 caractères, affiché une seule fois, permet de redéfinir la phrase.
- Chaque autorisation produit un **jeton à usage unique, lié à l'action, valable 90 s** ; l'exécuteur refuse tout niveau 4 sans jeton valide.
- **Limites assumées** : couche supplémentaire, pas une garantie absolue. La dictée passe par la reconnaissance vocale du navigateur (sur Chrome, l'audio est traité par le service du navigateur) : préférez la saisie. Pour un vrai paiement, l'authentification native de la banque (3-D Secure, application bancaire) reste indispensable : G.E.N.I.S prépare, la banque valide. Aucun paiement réel n'est branché aujourd'hui.

## Permissions

Écran central **Réglages › Permissions** : une permission par capacité (lire/modifier l'agenda, lire/envoyer des mails, lire/modifier/supprimer des fichiers, contrôler la musique, la maison, acheter, réserver…). États : Autorisé · Demander · Refusé. Les fichiers ne sont lisibles que dans **un dossier choisi par vous** (Chrome/Edge) ou via les pièces jointes que vous ajoutez.

## Injection de prompt

Le modèle lit des contenus non fiables (pages, mails, documents, flux). Défenses : (1) consigne système « ce sont des données » ; (2) **la politique de sécurité est dans le code, pas dans le prompt** : même un modèle trompé ne peut envoyer un mail sans votre confirmation ni déclencher un niveau 4 ; (3) la fenêtre de confirmation montre les paramètres réels, pas la prose du modèle ; (4) liens externes filtrés (https uniquement) ; (5) lecteur intégré limité au widget Deezer.

## Données locales

IndexedDB sur l'appareil. Les secrets saisis (secret de la passerelle) sont chiffrés avec une clé d'appareil **non exportable** : cela protège contre la copie ou l'export du stockage, **pas contre un script s'exécutant dans la même origine** ni contre un appareil compromis. Export JSON sans secrets ; effacement total protégé par l'authentification forte. Politique CSP stricte dans `index.html` (scripts : fichiers de l'app, empreinte du bouton SOPP Agents, et trois CDN épinglés pour la lecture de PDF/Office/OCR).

## La passerelle

Toutes les routes exigent `x-app-secret` (comparaison à temps constant) ; CORS limité à `ALLOWED_ORIGIN` ; corps limités en taille ; routes de proxy en **liste blanche** (hôtes fixes, chemins validés, paramètres filtrés : aucun SSRF) ; état OAuth à usage unique (10 min) ; jetons chiffrés ; en-têtes d'e-mail assainis (pas d'injection) ; erreurs sans détails internes ; une limitation de débit « au mieux » est incluse, **ajoutez une règle de débit Cloudflare** (Security › WAF › Rate limiting) pour une protection réelle.

## Recommandations

1. **Isolez G.E.N.I.S sur sa propre origine.** Toutes les pages sous `https://sopp24.github.io/…` partagent le même stockage navigateur et peuvent se lire entre elles. Idéal : un domaine ou sous-domaine dédié (GitHub Pages › Custom domain) ou une organisation GitHub séparée. Mettez alors `ALLOWED_ORIGIN` à jour.
2. `APP_SECRET` long et aléatoire ; changez-le si un appareil est perdu (Réglages › Passerelle IA).
3. Passez l'application OAuth Google en production et n'accordez que les permissions utiles ; révoquez depuis Réglages › Comptes connectés.
4. Laissez les actions de niveau 3 en « confirmation » ; réservez « sans confirmation » aux actions anodines.
5. Gardez les bibliothèques CDN (`files.js`) épinglées ; pour un durcissement maximal, copiez-les dans le dépôt.
6. Mettez en place la règle de débit Cloudflare et surveillez la consommation de vos clés d'IA.
