/* G.E.N.I.S — politique de sécurité. Décide, pour chaque appel d'outil, s'il peut s'exécuter directement,
   s'il faut une permission, une confirmation simple ou une authentification forte.
   Niveau 1 lecture · 2 préparation · 3 action · 4 action sensible. Le modèle d'IA ne peut jamais contourner cette couche. */
import { PERMISSIONS, permState, confirmMode } from './permissions.js';
export const LEVELS = { 1: 'Lecture', 2: 'Préparation', 3: 'Action', 4: 'Action sensible' };
export function evaluate(cap, params = {}, ctx = {}) {
  const perm = PERMISSIONS[cap.permission];
  const level = Math.max(cap.level || 1, perm?.level || 1, ctx.escalate || 0);
  const state = !cap.permission || ctx.grantedOnce === cap.permission ? 'granted' : permState(cap.permission);
  if (state === 'denied') return { decision: 'deny', level, reason: `La permission « ${perm.label} » est désactivée dans les réglages.` };
  if (state === 'ask') return { decision: 'ask_permission', level, permission: cap.permission, reason: `G.E.N.I.S demande l’autorisation de : ${perm.label.toLowerCase()}.` };
  if (level >= 4) return { decision: 'strong', level, reason: 'Action sensible : authentification forte obligatoire (phrase secrète + deux touches).' };
  if (level === 3) {
    if (ctx.ambiguous) return { decision: 'confirm', level, reason: 'Je ne suis pas certaine d’avoir bien compris : je vérifie avant d’agir.' };
    return confirmMode(cap.permission) === 'auto' ? { decision: 'allow', level } : { decision: 'confirm', level, reason: 'Cette action a un effet réel : votre confirmation est requise.' };
  }
  return { decision: 'allow', level };
}
