export const CONNECTORS=[
 {id:'sopp-language',name:'SOPP Language',kind:'Écosystème SOPP',status:'prepared',level:'open',url:'https://example.com/sopp-language',note:'Définir l’URL publique ou un endpoint de traduction avant activation.'},
 {id:'pharma-sopp',name:'Pharma SOPP',kind:'Écosystème SOPP',status:'prepared',level:'read',url:'https://example.com/pharma-sopp',note:'Prévoir une API ou une URL officielle du service.'},
 {id:'open-meteo',name:'Open-Meteo',kind:'Météo',status:'ready',level:'read',url:'https://open-meteo.com/',note:'Fonctionne sans clé API pour le prototype météo.'},
 {id:'google-calendar',name:'Google Agenda',kind:'Productivité',status:'prepared',level:'write',note:'OAuth Google à configurer côté backend.'},
 {id:'google-maps',name:'Google Maps',kind:'Navigation',status:'prepared',level:'read',note:'API Maps / Routes selon la fonctionnalité.'},
 {id:'gmail',name:'Gmail',kind:'Messagerie',status:'prepared',level:'write',note:'OAuth Google + scopes Gmail.'},
 {id:'outlook',name:'Outlook',kind:'Messagerie',status:'prepared',level:'write',note:'OAuth Microsoft Graph.'},
 {id:'deezer',name:'Deezer',kind:'Audio',status:'prepared',level:'control',note:'Contrôle réel dépendant des autorisations et APIs disponibles.'},
 {id:'sncf',name:'SNCF Connect',kind:'Voyage',status:'prepared',level:'book',note:'Recherche / réservation via service officiel si accès disponible.'},
 {id:'vinted',name:'Vinted',kind:'Shopping',status:'prepared',level:'prepare',note:'Prévoir accès compatible; ne jamais simuler un panier ou achat.'},
 {id:'doctolib',name:'Doctolib',kind:'Santé',status:'prepared',level:'book',note:'Connecteur soumis aux interfaces officielles disponibles.'},
 {id:'pronote',name:'Pronote',kind:'Éducation',status:'prepared',level:'read',note:'À connecter via mécanisme officiellement supporté.'},
 {id:'bnp',name:'BNP Paribas',kind:'Finance',status:'planned',level:'sensitive',note:'Domaine extrêmement sensible; lecture seule avant toute autre capacité.'},
 {id:'smart-home',name:'Maison connectée',kind:'Domotique',status:'planned',level:'sensitive',note:'Prévoir passerelle domotique et confirmations renforcées.'}
];
