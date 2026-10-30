# Sécurité GENIS

## Principe
Une réponse textuelle ne prouve jamais qu'une action externe a été réalisée. Les outils actuellement exposés au modèle sont strictement limités à l'heure, au calcul, à la météo et à la recherche Wikipédia.

## Niveaux de risque
| Niveau | Exemple | Politique |
|---|---|---|
| Lecture | heure, météo, encyclopédie | exécution directe |
| Préparation | brouillon de mail, panier, réservation | connecteur officiel requis |
| Action | envoyer, réserver, modifier | confirmation et vérification du service |
| Sensible | paiement, virement, suppression, domotique critique | authentification forte + confirmation |

## Secrets
- Ne jamais committer une clé API.
- Cloudflare Worker : secret `APP_SECRET` et clé fournisseur `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`.
- `AI_PROVIDER` doit correspondre au fournisseur configuré.
- `ALLOWED_ORIGIN` contient les origines exactes autorisées, jamais `*`.
- Le diagnostic `GET` du Worker n'expose aucune valeur de secret : il indique uniquement si le secret existe, s'il correspond au secret partagé fourni et quelles clés fournisseur sont présentes.
- Le secret partagé saisi dans GENIS est stocké dans le localStorage : ce n'est pas un coffre-fort.
- Les souvenirs choisis sont transmis au fournisseur IA avec les requêtes.
- Lorsqu'une demande fait explicitement référence à une discussion passée, GENIS recherche des extraits pertinents dans les autres conversations stockées localement et transmet uniquement ces extraits sélectionnés au fournisseur IA pour répondre.
- Les clés fournisseur ne sont jamais envoyées au navigateur.
- Le Worker n'expose aucune fonction de paiement, virement, achat, réservation, messagerie, agenda, compte ou domotique.

## Données locales
Historique, souvenirs, tâches et automatisations sont conservés dans le localStorage du navigateur. Ils ne sont pas synchronisés entre appareils et ne sont pas chiffrés comme dans un coffre-fort.

## Fichiers
L'accès exige la permission Fichiers. GENIS extrait localement TXT/MD/CSV/JSON/code, PDF, DOCX, XLSX/XLS, PPTX et images via OCR français/anglais. Les bibliothèques sont chargées depuis des CDN lors de leur première utilisation. Les fichiers ne sont pas envoyés automatiquement : seul le texte extrait est transmis au fournisseur après envoi explicite de la demande. Le contexte des pièces jointes envoyé au modèle est plafonné à 48 000 caractères cumulés par demande. GENIS ne modifie ni ne supprime les fichiers.

## Microphone et notifications
Le microphone nécessite l'autorisation GENIS et celle du navigateur. Il est désactivé au démarrage. Les notifications nécessitent l'autorisation GENIS et celle du navigateur. Les rappels locaux ne sont pas garantis si le navigateur suspend ou ferme l'application. Le Worker limite les corps de requête à 256 Ko, les conversations à 180 000 caractères cumulés et les boucles d'outils à cinq tours.

## Géolocalisation
La géolocalisation est sollicitée uniquement si la permission GENIS est activée. Une ville par défaut peut être définie dans les réglages.
