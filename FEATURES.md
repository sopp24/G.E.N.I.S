# État par rapport au cahier des charges

**Réel** : fonctionne et est testé (logique + interface simulée). **Partiel** : fonctionne avec des limites dites clairement. **Préparé** : architecture et déclaration prêtes, inactif. Voir `INTEGRATIONS.md` pour le détail par service.

| Exigence | État | Où |
|---|---|---|
| Orchestrateur (comprendre → planifier → agir → vérifier → répondre), pas un simple chat | Réel | `brain.js`, `executor.js`, `agents.js` |
| Onde blanche ferrofluide réactive (micro et voix), 7 états, mobile fluide | Réel | `waveform.js` |
| Voix expressive (intonation, pauses, émotions par contexte), moteur remplaçable | Réel (voix neuronale : à valider sur vos clés) | `tts.js`, `worker.js` |
| Micro activable/coupable, état très clair, jamais d'écoute simulée | Réel | `voice.js`, `ui.js` |
| Saisie texte + dock permanent (macOS-like, adapté mobile) | Réel | `ui.js`, `styles.css` |
| Historique, recherche, mémoire structurée visible/modifiable, rappel par date | Réel | `memory.js`, `panels.js` |
| Commandes personnalisées (phrase → actions) et automatisations (heure, date, événement) | Réel | `automations.js`, `scheduler.js` |
| Multitâche : espaces parallèles, onglets, vue d'ensemble | Réel | `spaces.js`, `ui.js` |
| Contrôle d'apps : API officielles d'abord, jamais de simulation, repli « ouvrir la page » | Réel | `connectors.js`, `executor.js` |
| Architecture modulaire connecteurs/agents/outils | Réel | `connector-*.js`, `agents.js` |
| SOPP Language / Pharma SOPP / SOPP Agents | Partiel (pont à implémenter côté SOPP) | `connector-sopp.js` |
| Deezer | Partiel | `connector-deezer.js` |
| Météo | Réel | `connector-weather.js` |
| Module voyage (transport, logement, planning, budget) | Réel pour planning et budget ; prix et réservations : liens préparés | `connector-travel.js` |
| Maison connectée | Préparé | `connectors-prepared.js` |
| Google Agenda, Gmail | Réel (après configuration OAuth) | `connector-google.js`, `worker.js` |
| Google Maps | Partiel (OpenStreetMap + liens officiels) | `connector-maps.js` |
| Google Docs / Sheets / Slides | Préparé | `connectors-prepared.js` |
| Réservations (restaurant, coiffeur, cinéma, VTC) | Partiel (recherche réelle, réservation préparée) | `connector-booking.js` |
| Module IA multi-modèles, calcul, synthèse, rédaction, minuteurs | Réel | `worker.js`, `brain.js` |
| Slack, Discord, Outlook, Teams | Préparé | `connectors-prepared.js` |
| Divertissement vidéo | Partiel (ouverture) | `connector-media.js` |
| Achats (Vinted, Leboncoin, Amazon…) | Partiel (recherche filtrée + liste de souhaits) | `connector-shopping.js` |
| Santé/administratif, Pronote, BNP | Préparé / Prévu (règles renforcées) | `connectors-prepared.js` |
| Actualités multi-sources | Réel (via la passerelle) | `connector-knowledge.js` |
| SNCF | Préparé (+ liens) | `connectors-prepared.js` |
| Réveil et actions programmées | Partiel (limites des PWA, export `.ics`) | `scheduler.js` |
| Comptes connectés (voir, permissions, révoquer, reconnecter) | Réel pour Google ; autres préparés | `panels.js` |
| Niveaux 1–4, permissions centralisées, confirmations intelligentes | Réel | `security.js`, `permissions.js` |
| Authentification forte pour les paiements (phrase + deux touches, hash, récupération) | Réel (aucun paiement réel branché) | `strong-auth.js`, `modals.js` |
| Sécurité des fichiers (lire / modifier / supprimer séparés) | Réel | `connector-files.js`, `files.js` |
| Interface des actions en direct, historique des tâches, notifications | Réel | `ui.js`, `executor.js`, `notifications.js` |
| Erreurs compréhensibles, jamais de réussite fictive | Réel | `executor.js`, `brain.js` |
| Responsive (ordinateur, tablette, mobile), accessibilité | Réel | `styles.css`, `ui.js` |
| Réglages complets, PWA installable, hors ligne partiel | Réel | `panels.js`, `sw.js`, `manifest.webmanifest` |
| Dépôt prêt pour GitHub (plat), vérifications locales (`npm run verify`), variables d'environnement, docs | Réel | ce dépôt |

## Non fait volontairement

Paiements réels, achats automatiques, lecture de Vinted/Leboncoin/Doctolib/Pronote/banque (aucune voie officielle ou trop risquée), contrôle de lecture Netflix/YouTube, commandes « suivant/volume » dans Deezer, réveil système natif, streaming des réponses (prévu), application native (prévue).
