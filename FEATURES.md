# État des fonctionnalités GENIS 0.1

| Domaine | État | Notes |
|---|---|---|
| UI GENIS | ✅ | interface sombre responsive |
| Onde réactive | ✅ | Canvas + niveau audio |
| Microphone | ✅ | Web Speech API / autorisation navigateur |
| Synthèse vocale | ✅ | SpeechSynthesis, moteur remplaçable |
| Texte | ✅ | saisie + conversation |
| Historique | ✅ | stockage local |
| Mémoire | ✅ | ajout / modification / suppression / consultation locale |
| Minuteur | ✅ | tâche locale + notification |
| Météo | ✅ | Open-Meteo, prévisions du jour et du lendemain, ville par défaut ou localisation autorisée dans GENIS |
| Recherche web | ✅ | ouverture d'une recherche, sans analyse fictive |
| Ouverture de services | ✅ | liens connus uniquement |
| Notifications | ✅ | API Notification selon navigateur et permission accordée |
| Automatisations | ✅ prototype | phrase déclencheuse + action locale (réponse, ouverture d’un service connu ou minuteur) |
| Permissions | ✅ | centre de réglages local |
| Passerelle IA | ✅ préparée | Cloudflare Worker, origine exacte autorisée et secrets côté serveur obligatoires |
| Fichiers texte | ✅ prototype | TXT, Markdown, CSV, JSON, HTML, XML et LOG (2 Mo max par fichier ; pas d’extraction PDF/Office) |
| Google Agenda | 🧩 | connecteur préparé, OAuth à ajouter |
| Gmail / Outlook | 🧩 | connecteurs préparés |
| Deezer | 🧩 | contrôle réel dépendant des APIs/permissions |
| SNCF / Vinted / Doctolib | 🧩 | intégrations à connecter officiellement |
| SOPP Language / Pharma SOPP | 🧩 | endpoints/URLs officielles à configurer |
| Banque / maison connectée | 🔒 | architecture prévue, activation volontairement non disponible |
| Paiements | 🔒 | aucune exécution dans ce prototype |
| Multitâche avancé | 🧭 | couche à développer en phase 2 |
| Agents spécialisés | 🧭 | registre de compétences à développer en phase 2 |
