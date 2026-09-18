# Architecture GENIS

## Flux principal

```text
Utilisateur
   ↓ voix / texte
UI GENIS
   ↓
Intent local
   ├── outils locaux (minuteur, météo, mémoire, recherche)
   ├── connecteurs (Google, Deezer, SNCF, etc.)
   └── passerelle IA
          ↓
       Cloudflare Worker
          ↓
       fournisseur IA
```

## Principes

- Les connecteurs sont indépendants.
- Le navigateur ne reçoit pas de clé API fournisseur.
- La mémoire reste locale dans cette version.
- Toute capacité externe doit exposer son niveau de risque et ses permissions.
- Une action réussie doit être vérifiée auprès du service réel avant de produire une confirmation.
- Le moteur d'intention peut évoluer vers un orchestrateur LLM + outils structurés sans réécrire l'interface.

## Extension future

Chaque connecteur peut être refactoré vers :

```js
{
  id,
  capabilities,
  permissions,
  auth,
  actions,
  execute(),
  verify(),
  errors
}
```

Le prochain palier est d'ajouter un registre de compétences et un moteur de plan :

```text
intention → plan JSON → policy check → confirmation → tool execution → verify → result
```

Le plan doit rester séparé du texte de réponse afin d'éviter qu'un modèle puisse déclencher directement une action sensible sans passage par la politique de sécurité.
