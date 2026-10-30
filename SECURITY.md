# Sécurité GENIS

## Règle de base

GENIS sépare l'intention de l'exécution. Une réponse textuelle ne constitue jamais la preuve qu'une action externe a été réalisée.

## Niveaux de risque

| Niveau | Exemple | Comportement cible |
|---|---|---|
| Lecture | météo, agenda, recherche | exécution directe |
| Préparation | brouillon de mail, panier, réservation | préparation puis validation selon réglages |
| Action | envoyer, réserver, modifier | confirmation selon politique |
| Sensible | paiement, virement, suppression définitive, domotique critique | authentification forte + confirmation |

## Secrets

- Ne jamais committer une clé API.
- Les secrets fournisseurs vont dans les secrets du fournisseur d'hébergement backend.
- Pour Cloudflare Worker : `ANTHROPIC_API_KEY` et `APP_SECRET` sont des Secrets obligatoires.
- `ALLOWED_ORIGIN` doit contenir une ou plusieurs origines exactes autorisées (sans chemin). Le Worker refuse les origines absentes ou non autorisées et n'accepte jamais `*`.
- Le secret partagé saisi dans GENIS reste stocké dans le `localStorage` de ce navigateur : il n'est pas un coffre-fort et ne doit pas être partagé. L'export JSON l'exclut volontairement.
- Ne jamais demander à un modèle de langage de transmettre ou d'afficher un token.
- Le frontend ne doit pas être considéré comme un coffre-fort à secrets.

## Données locales

La mémoire et l'historique du prototype sont stockés dans le `localStorage` du navigateur. Cela permet une autonomie simple mais n'offre pas les propriétés d'un coffre-fort. Pour une mémoire cloud, passer à une base sécurisée et chiffrée côté serveur avec authentification utilisateur.

## Actions sensibles

La version livrée ne réalise aucun paiement ni virement. Toute intégration bancaire ou domotique doit introduire une politique serveur, une confirmation explicite et les mécanismes d'authentification natifs du service concerné avant activation.

## Fichiers

L'accès aux fichiers doit rester explicite. Une future intégration de fichiers devra distinguer lecture, modification et suppression. La suppression définitive doit être classée sensible.
## Autorisation et fichiers locaux

- La géolocalisation n'est sollicitée que si l'autorisation **Localisation** a été activée dans GENIS. Une ville par défaut peut aussi être définie dans les réglages.
- L'accès au microphone est contrôlé par la permission GENIS et par la permission du navigateur. Le microphone est désactivé au chargement de chaque nouvelle session ; l'utilisateur doit le réactiver explicitement.
- La lecture de fichiers exige l’activation de la permission **Fichiers** dans GENIS. Les fichiers texte pris en charge sont lus localement et transmis à la passerelle IA uniquement lorsque l’utilisateur envoie une demande. Les formats binaires (PDF, DOCX, images, etc.) ne sont pas extraits dans cette version.
- Les notifications système nécessitent à la fois la permission **Notifications** dans GENIS et l’autorisation du navigateur. Désactiver la permission dans GENIS empêche l’envoi de notifications système même si le navigateur reste autorisé.
- La réinitialisation supprime uniquement les clés `genis:` dans le stockage local et ne vide pas les données des autres applications partageant la même origine.
