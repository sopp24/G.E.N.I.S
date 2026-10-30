# État des fonctionnalités GENIS

| Domaine | État | Notes |
|---|---|---|
| UI GENIS | ✅ | interface sombre responsive |
| Onde réactive | 🧩 | Canvas et niveau du microphone ; animation d'état pendant la synthèse vocale, sans capture réelle du flux audio de sortie ; mode statique si reduced-motion est activé |
| Microphone | ✅ | Web Speech API selon navigateur et autorisation |
| Synthèse vocale | ✅ | SpeechSynthesis native, sélection parmi les voix françaises installées sur l'appareil |
| Texte et conversation | ✅ | contexte partagé voix/texte |
| Chat IA généraliste | ✅ | Anthropic / OpenAI via Worker ; clé fournisseur requise |
| Outils IA | ✅ | heure, calculatrice sans eval, météo Open-Meteo, Wikipédia ; max. 5 tours |
| Historique | ✅ | stockage local, conversations réouvrables |
| Recherche historique | ✅ | recherche plein texte dans toutes les conversations locales |
| Rappel de conversations | ✅ prototype | sélection d'extraits pertinents d'anciennes discussions et transmission au modèle pour répondre |
| Mémoire | ✅ | ajout, modification, suppression, consultation locale |
| Fichiers | ✅ prototype | TXT/MD/CSV/JSON/code, PDF à texte intégré (80 pages max), DOCX, XLSX/XLS, PPTX et OCR images ; 12 Mo/fichier, 48 000 caractères cumulés par demande |
| Minuteur / rappels | ✅ local | notifications lorsque l'application est active |
| Météo | ✅ | Open-Meteo, ville ou géolocalisation autorisée |
| Recherche encyclopédique | ✅ | Wikipédia via outil IA, avec URL d'article |
| Recherche web générale | 🧩 | ouverture d'une recherche externe, pas de synthèse web générale |
| Ouverture de services | ✅ | ouvre les sites connus ; pas de contrôle de compte |
| Notifications | 🧩 | Notifications API navigateur, contraintes d'arrière-plan |
| Automatisations | ✅ prototype | phrase déclencheuse ; édition, activation, suppression et plusieurs actions (réponse, ouverture, minuteur) exécutées en séquence ; pas de déclencheur calendaire/événementiel ou d'exécution garantie en arrière-plan |
| Permissions | ✅ | centre de réglages local |
| Connecteurs Google / Gmail / Outlook | 🧩 | OAuth/API à développer |
| Deezer / SNCF / Vinted / Doctolib / Pronote | 🧩 | API ou intégration officielle à configurer |
| SOPP Language / Pharma SOPP | 🧩 | endpoint public et authentification à configurer |
| Banque / maison connectée | 🔒 | domaine sensible, pas d'action activée |
| Paiements / achats / réservations | 🔒 | aucune exécution fictive ni action modèle exposée |
| Multitâche | 🧩 | plusieurs conversations locales conservées/réouvrables ; pas de fenêtres indépendantes ou d'espaces de travail simultanés |
| Agents spécialisés | 🧩 | première orchestration par outils ; agents métier dédiés à développer |
| PWA | ✅ | manifest, service worker, icônes et cache shell |
| CI GitHub Actions | ✅ | syntaxe, manifest, ressources, garde-fous DOM et tests Worker simulés (Anthropic/OpenAI) |
