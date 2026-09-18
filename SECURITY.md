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
- Pour Cloudflare Worker : `ANTHROPIC_API_KEY` est un Secret.
- Ne jamais demander à un modèle de langage de transmettre ou d'afficher un token.
- Le frontend ne doit pas être considéré comme un coffre-fort à secrets.

## Données locales

La mémoire et l'historique du prototype sont stockés dans le `localStorage` du navigateur. Cela permet une autonomie simple mais n'offre pas les propriétés d'un coffre-fort. Pour une mémoire cloud, passer à une base sécurisée et chiffrée côté serveur avec authentification utilisateur.

## Actions sensibles

La version livrée ne réalise aucun paiement ni virement. Toute intégration bancaire ou domotique doit introduire une politique serveur, une confirmation explicite et les mécanismes d'authentification natifs du service concerné avant activation.

## Fichiers

L'accès aux fichiers doit rester explicite. Une future intégration de fichiers devra distinguer lecture, modification et suppression. La suppression définitive doit être classée sensible.
