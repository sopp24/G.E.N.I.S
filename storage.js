const PREFIX = 'genis:';
const volatileStore = new Map();
const storageErrors = new Map();

function read(key, fallback) {
  if (volatileStore.has(key)) return volatileStore.get(key);
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value == null ? fallback : JSON.parse(value);
  } catch (error) {
    storageErrors.set(key, error?.name || 'StorageError');
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    volatileStore.delete(key);
    storageErrors.delete(key);
  } catch (error) {
    volatileStore.set(key, value);
    storageErrors.set(key, error?.name || 'StorageError');
  }
}
function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    volatileStore.delete(key);
    storageErrors.delete(key);
  } catch (error) {
    volatileStore.delete(key);
    storageErrors.set(key, error?.name || 'StorageError');
  }
}

export const storage = {
  read, write, remove,
  get persistenceWarning(){ return storageErrors.size ? 'Le stockage local est indisponible ou plein. Les changements récents sont conservés uniquement jusqu’à la fermeture ou l’actualisation de cette page.' : ''; },
  get persistenceAvailable(){ return storageErrors.size===0; },
  get settings(){ return read('settings', {theme:'dark', voiceEnabled:true, micEnabled:false, speechRate:1, volume:1, voiceName:'', gatewayUrl:'', gatewaySecret:'', provider:'anthropic', model:'claude-haiku-4-5-20251001', defaultCity:''}); },
  set settings(v){ write('settings', v); },
  get chats(){ return read('chats', []); }, set chats(v){ write('chats', v); },
  get activeChat(){ return read('activeChat', null); }, set activeChat(v){ write('activeChat', v); },
  get memories(){ return read('memories', []); }, set memories(v){ write('memories', v); },
  get automations(){ return read('automations', []); }, set automations(v){ write('automations', v); },
  get tasks(){ return read('tasks', []); }, set tasks(v){ write('tasks', v); },
  get notifications(){ return read('notifications', []); }, set notifications(v){ write('notifications', v); },
  get permissions(){ return read('permissions', {microphone:true, location:false, notifications:false, calendar:false, mail:false, files:false, smartHome:false, purchases:false, payments:false}); }, set permissions(v){ write('permissions', v); },
  get connected(){ return read('connected', {}); }, set connected(v){ write('connected', v); }
};

export function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
