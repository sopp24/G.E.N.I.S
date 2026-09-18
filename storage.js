const PREFIX = 'genis:';

function read(key, fallback) {
  try { const value = localStorage.getItem(PREFIX + key); return value == null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
function remove(key) { localStorage.removeItem(PREFIX + key); }

export const storage = {
  read, write, remove,
  get settings(){ return read('settings', {theme:'dark', voiceEnabled:true, micEnabled:false, speechRate:1, volume:1, gatewayUrl:'', gatewaySecret:'', model:'claude-haiku-4-5-20251001', defaultCity:''}); },
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
