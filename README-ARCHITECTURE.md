# Architecture GENIS

## Flux principal
```text
Utilisateur
   ↓ voix / texte / pièces jointes
UI GENIS
   ↓
Intent local
   ├── mémoire, minuteur, rappels, ouverture de services
   ├── extraction locale des fichiers (PDF/Office/OCR)
   └── passerelle IA
          ↓
       Cloudflare Worker
          ↓
       Anthropic ou OpenAI
          ↓ appels d'outils limités
       Heure / calcul / Open-Meteo / Wikipédia
```

## Principes
- Frontend statique à la racine, hébergé par GitHub Pages.
- Secrets fournisseurs conservés uniquement dans Cloudflare.
- Outils côté Worker en liste blanche, validation côté serveur et boucle plafonnée à cinq étapes.
- Aucune action sur compte, achat, paiement, réservation, message ou appareil n'est exposée au modèle.
- Historique, mémoire, tâches et automatisations restent locaux.
- Le texte extrait des fichiers n'est envoyé au fournisseur qu'après envoi explicite de la demande.
- Les connecteurs tiers doivent utiliser API officielle et OAuth.

## Extension future
Un connecteur métier devra décrire ses capacités, permissions, authentification, actions, niveau de risque, méthode d'exécution et méthode de vérification. Le futur flux d'action doit rester :
```text
intention → plan structuré → politique de permissions → confirmation
→ exécution connecteur → vérification fournisseur → résultat utilisateur
```
Les actions sensibles doivent être contrôlées côté serveur et ne jamais être déclenchées par une simple réponse textuelle du modèle.
