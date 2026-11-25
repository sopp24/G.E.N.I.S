# Intégrations

**Réel** = fonctionne maintenant. **Configuration** = fonctionne après une étape de votre part. **Préparé** = déclaré, volontairement inactif (aucun outil exposé à l'IA). **Prévu** = pas de voie officielle à ce jour.

## Réel, sans compte ni clé

| Service | Ce que fait G.E.N.I.S | Limites |
|---|---|---|
| Minuteurs, rappels, réveils | Programme, notifie, parle ; export `.ics` (alarme native) | Sonnent tant que l'app est ouverte |
| Calculatrice, heure, date | Évaluateur sûr (aucun `eval`) | — |
| Météo | Open-Meteo : actuel + 7 jours, conseils (parapluie, froid, chaleur) | Météo&Radar n'a pas d'API publique connue |
| Cartes | Lieux (Nominatim), itinéraires voiture/vélo/marche (OSRM), lien Google Maps officiel pour les transports en commun | Durées sans trafic ; pas d'horaires de transport |
| Wikipédia | Recherche + résumé | — |
| Voyages | Création, lieux (OpenStreetMap), planning validé, **budget** (options comparées, dépassements), export agenda | Prix de vols/trains/logements non lisibles : les montants sont les vôtres ou des **estimations marquées** |
| Restaurants | Recherche OpenStreetMap | Ni prix, ni avis, ni disponibilité ; la réservation se finalise sur la page |
| Achats | Recherche filtrée Vinted, Leboncoin, Amazon, Thomann, Zalando, Nike, E.Leclerc + liste de souhaits G.E.N.I.S | Pas de lecture des résultats, pas de liste du site, **aucun achat** |
| Mémoire, historique, automatisations, espaces | Local, visible, modifiable | — |
| Pièces jointes | Texte, CSV, JSON, PDF, DOCX, XLSX, PPTX, images (OCR) | 15 Mo ; bibliothèques chargées à la demande |
| Dossier autorisé | Lire/écrire/supprimer (niveau 4) dans un dossier choisi | Chrome/Edge ordinateur, durée de la session |
| Vidéo (YouTube, Twitch, Netflix, Disney+, Prime, Canal+) | Ouvre la page / la recherche | Aucun contrôle de lecture ouvert |

## Configuration requise (via la passerelle)

| Service | Étapes | Limites |
|---|---|---|
| IA : Claude, ChatGPT, Gemini | Une clé dans les secrets du Worker | Gemini : expérimental. Les noms de modèles sont modifiables (`MODEL_*`) |
| Voix neuronale | `OPENAI_API_KEY` (ou ElevenLabs) | Repli automatique sur la voix du navigateur |
| Transcription (Firefox, Brave…) | `OPENAI_API_KEY` | — |
| Deezer | Aucune clé : recherche via la passerelle, lecture dans le lecteur officiel | Pas d'accès à *vos* playlists, pas de commandes « suivant / volume » (limite du widget), extraits de 30 s hors connexion Deezer |
| Actualités | Aucune clé : flux RSS lus par la passerelle (Franceinfo, Le Monde, France 24, BBC) | Titres et résumés + lien ; l'adresse d'un flux peut changer (`NEWS_FEEDS`) |
| Google Agenda | OAuth (voir README) | Détecte les conflits avant d'ajouter |
| Gmail | OAuth | Lire, chercher, brouillons ; **envoi après confirmation** montrant destinataire, objet et texte réels |

## Écosystème SOPP

SOPP Agents : ouverture directe. **SOPP Language** et **Pharma SOPP** : renseignez leurs adresses dans *Réglages › Écosystème SOPP*. G.E.N.I.S les appelle comme n'importe quel outil via un pont `postMessage` ; si l'application ne répond pas, G.E.N.I.S le dit et ouvre la page avec le texte en paramètre (`?text=…&source=genis`, avec `from` et `to` pour les langues). **Contrat à implémenter côté SOPP** (≈ 10 lignes) :

```js
window.addEventListener('message', async e => {
  if (e.origin !== 'https://sopp24.github.io' || e.data?.type !== 'genis:request') return; // origine de G.E.N.I.S
  const { id, action, payload } = e.data;           // action : 'translate' → payload { text, from, to }
  try { const result = await handle(action, payload);   // renvoyer { text: '…' } pour translate
        e.source.postMessage({ type: 'sopp:response', id, ok: true, result }, e.origin); }
  catch (err) { e.source.postMessage({ type: 'sopp:response', id, ok: false, error: String(err.message || err) }, e.origin); }
});
```

## Préparé ou prévu

| Service | Voie visée | État |
|---|---|---|
| Outlook, Teams | Microsoft Graph (OAuth) | Préparé / Prévu |
| Slack, Discord | OAuth Slack ; bot Discord | Préparé |
| Google Docs, Sheets, Slides | Même OAuth que l'Agenda, scopes supplémentaires | Préparé |
| SNCF | API SNCF (Navitia) + lien SNCF Connect ; réservation sans API publique | Préparé |
| Uber, Uber Eats | API partenaire sur dossier ; en attendant lien profond | Prévu |
| Doctolib, Ameli, assurance | Aucune API publique : liens officiels, jamais de décision médicale | Prévu |
| Pronote | Pas d'API officielle ; les bibliothèques non officielles imposent de stocker des identifiants : non recommandé | Prévu |
| BNP Paribas | Open Banking DSP2 via un agrégateur agréé, **lecture seule** ; paiements = niveau 4 + authentification de la banque | Prévu |
| Maison connectée | Home Assistant (REST + Matter/Thread) ; serrures, alarme, caméras = niveau 4 | Préparé |

Pour activer un connecteur préparé : créez `connector-<id>.js` (voir `ARCHITECTURE.md`), supprimez son entrée de `connectors-prepared.js`, ajoutez le fichier à `MODULES` (`connectors.js`) et à `SHELL` (`sw.js`).
