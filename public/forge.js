'use strict';

const $ = id => document.getElementById(id);
const el = {
  status: $('status'), banner: $('banner'), toast: $('toast'),
  home: $('home'), runsPanel: $('runsPanel'), runsList: $('runsList'),
  newForm: $('newForm'), fName: $('fName'), fPronouns: $('fPronouns'), fWorld: $('fWorld'), fPlace: $('fPlace'), fSysVoice: $('fSysVoice'), fFamily: $('fFamily'), fFamilyDesc: $('fFamilyDesc'), familyWho: $('familyWho'), familyHint: $('familyHint'), fBackground: $('fBackground'), notesCount: $('notesCount'), fLandmarks: $('fLandmarks'),
  fPremise: $('fPremise'), premiseWrap: $('premiseWrap'), worldHint: $('worldHint'), fEnemies: $('fEnemies'),
  fStyle: $('fStyle'), styleSel: $('styleSel'), fTone: $('fTone'), fRating: $('fRating'), fRomance: $('fRomance'), fClass: $('fClass'), fClassCustom: $('fClassCustom'), fWords: $('fWords'), fVoice: $('fVoice'), startBtn: $('startBtn'),
  renameBtn: $('renameBtn'), play: $('play'), runMeta: $('runMeta'), runTitle: $('runTitle'), chapters: $('chapters'),
  listenAllBtn: $('listenAllBtn'), audiobookBtn: $('audiobookBtn'), textBtn: $('textBtn'), sheetToggle: $('sheetToggle'),
  writing: $('writing'), writingText: $('writingText'),
  decision: $('decision'), choices: $('choices'), customForm: $('customForm'), customInput: $('customInput'),
  micBtn: $('micBtn'), rerollBtn: $('rerollBtn'), sheet: $('sheet'),
  audio: $('audio'), plNow: $('plNow'), plNext: $('plNext'), plSkip: $('plSkip'), narrateBtn: $('narrateBtn'),
  autoNarrate: $('autoNarrate'), handsFree: $('handsFree'), handsFreeWrap: $('handsFreeWrap'),
  fSysName: $('fSysName'), fSysNameCustom: $('fSysNameCustom'), fPersonality: $('fPersonality'),
  fCompanion: $('fCompanion'), fCompanionDesc: $('fCompanionDesc'), partyList: $('partyList'), addMember: $('addMember'),
  fTurns: $('fTurns'), kidNote: $('kidNote'), fNotes: $('fNotes'), fAutoPoints: $('fAutoPoints'), advanced: $('advanced'),
  statusBtn: $('statusBtn'), pointsBadge: $('pointsBadge'), decisionTitle: $('decisionTitle'),
  steerChip: $('steerChip'), steerText: $('steerText'), steerClear: $('steerClear'),
  ideasBtn: $('ideasBtn'), ideasPanel: $('ideasPanel'), ideasList: $('ideasList'), steerForm: $('steerForm'), steerInput: $('steerInput'),
  pause: $('pause'), pauseTitle: $('pauseTitle'), pauseBody: $('pauseBody'), pauseClose: $('pauseClose'),
};

const S = { run: null, configured: false, busy: false, narrating: false, queue: [], qi: -1, mode: null, rec: null, tab: 'character', alloc: {}, painting: false, ideas: null };
const VOICE_OPTS = [
  ['onyx', 'Onyx: deep, American male'], ['ash', 'Ash: warm, American male'], ['echo', 'Echo: steady, American male'], ['verse', 'Verse: expressive, American male'],
  ['coral', 'Coral: warm, American female'], ['nova', 'Nova: bright, American female'], ['sage', 'Sage: calm, American female'], ['shimmer', 'Shimmer: soft, American female'],
  ['ballad', 'Ballad: smooth, theatrical'], ['alloy', 'Alloy: neutral, synthetic'], ['fable', 'Fable: British male'],
];
const fillVoices = (sel, value) => { sel.replaceChildren(...VOICE_OPTS.map(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; })); sel.value = value; };
const STATS = ['strength', 'agility', 'endurance', 'intelligence', 'perception', 'willpower'];
const SLOTS = ['head', 'chest', 'hands', 'legs', 'feet', 'main_hand', 'off_hand', 'accessory', 'vehicle'];
const slotName = k => k.replace('_', ' ');
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
const WORLD_NAMES = { vanished: 'The Long Silence', turning: 'The Turning', cataclysm: 'Cataclysm', earth: 'System Apocalypse', dungeon: 'Dungeon Break', dream: 'The Dreaming', space: 'Taken', fallen: 'Fallen Kingdom', wasteland: 'Wasteland Awakening', custom: 'Your World' };
const WORLD_HINTS = {
  earth: 'Monsters spawn, dungeons tear open, everyone gets a status screen. Society falls in hours.',
  dungeon: 'A year of dungeon gates, then they all break at once.',
  turning: 'Something buried inside the Earth wakes up. It’s our solar system’s turn, and we’re not the first. Gods and ancient beings are watching. Rise from day-one survivor to vehicles, aircraft and eventually ships, chasing who did this to us.',
  vanished: 'You wake at the spot where you were born, 100 years in the future. Nothing’s blown up. Everyone is just gone, and nobody has been here in years. Put your birthplace in the box below.',
  cataclysm: 'No monsters at first. A disaster wrecks the world, and the real cause is a mystery. Food, water, shelter, scavenging and other survivors. Maybe the System comes later.',
  dream: 'An AI holds humanity inside the virtual world we trained it on. The government harvests minds while people sleep, and everyone writes it off as dreaming. You’re the one who knows, and you start bending the rules.',
  space: 'The System doesn’t come to Earth. It takes you, into a universe full of alien species, empires and ruins.',
  fallen: 'Medieval fantasy. The walls break, the gods go silent, and the System offers power to survivors.',
  wasteland: 'Twenty years after the war, the System wakes up in the ruins.',
  custom: 'Write your own premise. The AI builds the world from it.',
};
const enemyBoxes = () => [...el.fEnemies.querySelectorAll('input')];
function syncWorld() {
  el.worldHint.textContent = WORLD_HINTS[el.fWorld.value] || '';
  el.premiseWrap.hidden = el.fWorld.value !== 'custom';
}
el.fWorld.addEventListener('change', () => { syncWorld(); if (!el.premiseWrap.hidden) el.fPremise.focus(); });

// ---------- small helpers ----------
const pref = {
  get(k, d) { try { const v = localStorage.getItem('forge.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('forge.' + k, JSON.stringify(v)); } catch {} },
};
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : String(kid));
  return n;
}
let toastTimer;
function toast(msg, isError = false) {
  el.toast.textContent = msg; el.toast.classList.toggle('error', isError); el.toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 9000 : 3500);
}
let statusTimer;
function status(text, busy = false) {
  clearInterval(statusTimer);
  el.status.classList.toggle('busy', busy);
  if (!busy) { el.status.textContent = text; return; }
  const t0 = Date.now();
  const tick = () => { el.status.textContent = `${text} ${Math.round((Date.now() - t0) / 1000)}s`; };
  tick(); statusTimer = setInterval(tick, 1000);
}
async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && A.hosted && !path.startsWith('/api/auth/')) showJoin();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}
async function get(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && A.hosted) showJoin();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

// ---------- beta accounts (hosted) ----------
const A = { hosted: false, user: null };
const $$ = id => document.getElementById(id);
function showJoin() {
  el.home.hidden = true; el.play.hidden = true; document.body.classList.remove('playing-view');
  $$('join').hidden = false; $$('accountBtn').hidden = true;
  const code = new URLSearchParams(location.search).get('code');
  if (code && !$$('jCode').value) $$('jCode').value = code;
  ($$('jCode').value ? $$('jName') : $$('jCode')).focus();
}
$$('joinForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { user } = await post('/api/auth/join', { code: $$('jCode').value, name: $$('jName').value });
    A.user = user; $$('join').hidden = true;
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
    afterSignIn(); route();
    toast(`Welcome, ${user.name}.`);
  } catch (err) { toast(err.message, true); }
});
function afterSignIn() {
  $$('accountBtn').hidden = !A.user;
  if (A.user) $$('accountBtn').textContent = `👤 ${A.user.name}`;
  if (A.user && !el.fName.value) el.fName.value = A.user.name;
}
async function refreshMe() {
  try { const me = await get('/api/auth/me'); if (me.user) { A.user = me.user; afterSignIn(); } } catch {}
}
const LIMIT_NAMES = { chapter: 'Chapters', narration: 'Narrated chapters', portrait: 'Portraits', ideas: 'Idea pitches' };
$$('accountBtn').addEventListener('click', async () => {
  await refreshMe();
  const u = A.user; if (!u) return;
  $$('acTitle').textContent = u.name;
  $$('acBody').replaceChildren(...[
    h('h3', {}, 'Your player code'),
    h('div', { class: 'pcode' }, u.pcode),
    h('p', { class: 'appearance' }, 'Use this to sign in on your phone or another computer. Your stories follow you. Keep it to yourself.'),
    u.limits ? h('h3', {}, 'This week (resets Monday)') : null,
    u.limits ? h('div', { class: 'usage-row' }, ...Object.entries(u.limits).flatMap(([k, max]) => [h('span', {}, LIMIT_NAMES[k] || k), h('span', {}, `${u.usage?.[k] || 0} / ${max}`)])) : null,
    u.admin ? h('p', {}, h('a', { href: '/admin', class: 'btn small' }, 'Open admin page')) : null,
    h('div', { class: 'decision-foot' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await post('/api/auth/logout', {}); location.reload(); } }, 'Sign out')),
  ].filter(Boolean));
  $$('account').hidden = false;
});
$$('acClose').addEventListener('click', () => { $$('account').hidden = true; });

// ---------- feedback ----------
$$('feedbackBtn').addEventListener('click', () => { $$('feedback').hidden = false; $$('fbText').focus(); });
$$('fbClose').addEventListener('click', () => { $$('feedback').hidden = true; });
$$('fbSend').addEventListener('click', async () => {
  const text = $$('fbText').value.trim();
  if (!text) return $$('fbText').focus();
  const page = S.run ? `${S.run.title} · chapter ${S.run.chapters.length}` : 'home';
  try { await post('/api/feedback', { text, page }); $$('fbText').value = ''; $$('feedback').hidden = true; toast('Thanks! Feedback sent.'); }
  catch (err) { toast(err.message, true); }
});
// ---------- ideas board ----------
async function loadIdeas(data) {
  const box = $$('ideasBoard');
  try { data = data || await get('/api/ideas'); } catch (err) { box.replaceChildren(h('p', { class: 'empty' }, err.message)); return; }
  const act = (url, body) => async () => { try { loadIdeas(await post(url, body)); } catch (err) { toast(err.message, true); } };
  const badge = { planned: 'PLANNED', done: 'DONE' };
  box.replaceChildren(...(data.ideas.length ? data.ideas.map(i => h('div', { class: `idea${i.status === 'done' ? ' is-done' : ''}` },
    h('button', { class: `vote${i.mine ? ' on' : ''}`, type: 'button', 'aria-pressed': String(i.mine), 'aria-label': i.mine ? 'Remove your vote' : 'Vote for this idea', onclick: act('/api/ideas/vote', { id: i.id }) }, h('span', {}, '▲'), h('b', {}, String(i.votes))),
    h('div', { class: 'idea-main' },
      h('div', { class: 'idea-text' }, badge[i.status] ? h('span', { class: `tag ${i.status}` }, badge[i.status]) : null, i.text),
      h('div', { class: 'card-sub' }, `${i.by}`, i.own || data.admin ? h('button', { class: 'linkish', type: 'button', onclick: act('/api/ideas/remove', { id: i.id }) }, 'remove') : null)),
  )) : [h('p', { class: 'empty' }, 'No ideas yet. Be the first.')]));
}
$$('ideaForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $$('ideaText').value.trim();
  if (!text) return $$('ideaText').focus();
  try { loadIdeas(await post('/api/ideas', { text })); $$('ideaText').value = ''; toast('Idea posted. Others can vote on it now.'); }
  catch (err) { toast(err.message, true); }
});
$$('feedbackBtn').addEventListener('click', () => loadIdeas());
for (const id of ['feedback', 'account']) $$(id).addEventListener('click', e => { if (e.target.id === id) $$(id).hidden = true; });
const audioUrl = (file) => `/api/forge/audio?id=${encodeURIComponent(S.run.id)}&file=${file}`;
const latest = () => S.run.chapters.at(-1);
const has = (c, k) => Boolean(S.run.audio?.[c.uid]?.[k]);
const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr} hr ago`;
  return new Date(t).toLocaleDateString();
};

// ---------- routing ----------
function route() {
  const m = /^#run=([a-f0-9-]{36})$/.exec(location.hash);
  stopAudio(); stopListening();
  if (!el.pause.hidden) { el.pause.hidden = true; document.body.style.overflow = ''; }
  if (m) openRun(m[1]); else showHome();
}
window.addEventListener('hashchange', route);

// ---------- home ----------
async function showHome() {
  S.run = null;
  document.body.classList.remove('playing-view');
  el.play.hidden = true; el.home.hidden = false;
  document.title = 'Story Forge';
  try {
    const { runs } = await get('/api/forge/runs');
    el.runsList.replaceChildren(...runs.map(r => h('div', { class: 'run' },
      h('div', { class: 'run-title' }, r.title || 'Untitled run'),
      h('div', { class: 'run-meta' }, `${r.name} · ${r.cls || 'Unclassed'} · Level ${r.level} · ${r.chapters} chapter${r.chapters === 1 ? '' : 's'} · ${ago(r.updated)}`),
      h('div', { class: 'run-actions' },
        h('a', { class: 'btn primary', href: `#run=${r.id}` }, 'Continue'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { if (await renameRun(r.id, r.title)) showHome(); } }, 'Rename'),
        h('button', { class: 'btn ghost', type: 'button', title: 'Delete this run', onclick: () => deleteRun(r) }, 'Delete')),
    )));
    el.runsPanel.hidden = runs.length === 0;
  } catch (e) { toast(e.message, true); }
}
async function renameRun(id, current) {
  const title = prompt('Story title:', current || '');
  if (title == null || !title.trim() || title.trim() === current) return null;
  try { const res = await post('/api/forge/rename', { id, title: title.trim() }); toast('Renamed.'); return res.title; }
  catch (e) { toast(e.message, true); return null; }
}
async function deleteRun(r) {
  if (!confirm(`Delete "${r.title}" and its narration for good?`)) return;
  try { await post('/api/forge/delete', { id: r.id }); showHome(); } catch (e) { toast(e.message, true); }
}
el.fClass.addEventListener('change', () => {
  el.fClassCustom.hidden = el.fClass.value !== '__custom';
  if (!el.fClassCustom.hidden) el.fClassCustom.focus();
});
// ----- advanced setup -----
el.fSysName.addEventListener('change', () => {
  el.fSysNameCustom.hidden = el.fSysName.value !== '__custom';
  if (!el.fSysNameCustom.hidden) el.fSysNameCustom.focus();
});
el.fCompanion.addEventListener('change', () => { el.fCompanionDesc.hidden = el.fCompanion.value !== 'start'; });
function addMember(m = { name: '', kid: false }) {
  if (el.partyList.children.length >= 5) return toast('Up to 5 party members.');
  const name = h('input', { type: 'text', maxlength: 30, placeholder: 'Name', 'aria-label': 'Party member name' });
  name.value = m.name;
  const kid = h('input', { type: 'checkbox' }); kid.checked = m.kid;
  kid.addEventListener('change', syncKids);
  const row = h('div', { class: 'member' }, name, h('label', { class: 'toggle' }, kid, ' Kid'),
    h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Remove', onclick: () => { row.remove(); syncKids(); } }, '✕'));
  el.partyList.append(row);
  syncKids();
  return name;
}
const partyMembers = () => [...el.partyList.children].map(r => ({ name: r.querySelector('input[type=text]').value.trim(), kid: r.querySelector('input[type=checkbox]').checked })).filter(m => m.name);
function syncKids() {
  const kids = [...el.partyList.querySelectorAll('input[type=checkbox]')].some(b => b.checked);
  el.kidNote.hidden = !kids;
  if (kids) {
    if (!el.fRating.disabled) { el.fRating.dataset.was = el.fRating.value; el.fRomance.dataset.was = el.fRomance.value; }
    el.fRating.value = 'pg'; el.fRomance.value = 'off';
  } else if (el.fRating.disabled) {
    el.fRating.value = el.fRating.dataset.was || 'r'; el.fRomance.value = el.fRomance.dataset.was || 'off';
  }
  el.fRating.disabled = el.fRomance.disabled = kids;
}
el.addMember.addEventListener('click', () => addMember()?.focus());
const FAMILY_HINTS = {
  offscreen: 'They’re safe. The story won’t dwell on it.',
  sanctuary: 'At integration, the System takes every child, every pregnant woman and every mother into Sanctuary. You wake up alone in a half-empty world. Rumors first, then proof, then a way to send messages, and someday a reunion. Grind to get there.',
  search: 'They’re alive and resourceful. Follow clues and near-misses until you find them.',
  with: 'They’re in the story beside you. Tip: if they’re playing along in the car, add them as party members instead.',
};
function syncFamily() {
  const v = el.fFamily.value;
  el.familyWho.hidden = v === 'none';
  el.familyHint.hidden = !FAMILY_HINTS[v];
  el.familyHint.textContent = (FAMILY_HINTS[v] || '') + (FAMILY_HINTS[v] ? ' Loved ones are never killed or graphically hurt.' : '');
}
el.fFamily.addEventListener('change', syncFamily);
function syncCount() { el.notesCount.textContent = el.fNotes.value.length.toLocaleString(); }
el.fNotes.addEventListener('input', syncCount);

el.newForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (S.busy) return;
  const cls = el.fClass.value === '__custom' ? el.fClassCustom.value.trim() : el.fClass.value;
  const body = {
    name: el.fName.value.trim(), pronouns: el.fPronouns.value, world: el.fWorld.value, place: el.fPlace.value.trim(), landmarks: el.fLandmarks.value.trim(),
    premise: el.fPremise.value.trim(), tone: el.fTone.value, style: el.fStyle.value, pov: $('fPov').value, flavor: $('fFlavor').value, rating: el.fRating.value, romance: el.fRomance.value, enemies: enemyBoxes().filter(b => b.checked).map(b => b.value),
    cls, words: Number(el.fWords.value), voice: el.fVoice.value, sysVoice: el.fSysVoice.value, voiceMode: $('fVoiceMode').value,
    systemName: el.fSysName.value === '__custom' ? el.fSysNameCustom.value.trim() : el.fSysName.value,
    personality: el.fPersonality.value, companion: el.fCompanion.value, companionDesc: el.fCompanionDesc.value.trim(),
    background: el.fBackground.value.trim(), family: el.fFamily.value, familyDesc: el.fFamilyDesc.value.trim(), party: partyMembers(), turns: el.fTurns.checked, notes: el.fNotes.value.trim(), avoidNames: $('fAvoid').value.trim(), autoPoints: el.fAutoPoints.checked,
  };
  if (body.party.some(m => m.kid)) { body.rating = 'pg'; body.romance = 'off'; }
  if (!body.name) { el.fName.focus(); return toast('Give your hero a name.'); }
  if (body.world === 'custom' && body.premise.length < 20) { el.fPremise.focus(); return toast('Describe your world in a sentence or two.'); }
  pref.set('lastSetup', { ...body, clsSelect: el.fClass.value, sysSelect: el.fSysName.value, ratingPick: el.fRating.dataset.was || body.rating, romancePick: el.fRomance.dataset.was || body.romance, advancedOpen: el.advanced.open });
  S.busy = true; el.startBtn.disabled = true;
  el.startBtn.textContent = 'The System is integrating…';
  status('Writing chapter 1…', true);
  try {
    const { run } = await post('/api/forge/new', body);
    S.run = run; S.busy = false;
    history.replaceState(null, '', `#run=${run.id}`);
    showRun();
    afterChapter();
  } catch (err) {
    toast(err.message, true); status('');
  } finally {
    S.busy = false; el.startBtn.disabled = !S.configured; el.startBtn.textContent = 'Enter the System';
  }
});
fillVoices(el.fVoice, 'onyx'); fillVoices(el.fSysVoice, 'alloy');
function restoreSetup() {
  const s = pref.get('lastSetup', null);
  syncWorld();
  if (!s) return;
  el.partyList.replaceChildren();
  el.fName.value = s.name || ''; el.fPronouns.value = s.pronouns || 'he/him'; el.fWorld.value = s.world || 'earth';
  el.fPlace.value = s.place || ''; el.fLandmarks.value = s.landmarks || ''; el.fBackground.value = s.background || ''; el.fFamily.value = s.family || 'none'; el.fFamilyDesc.value = s.familyDesc || ''; syncFamily(); el.fWords.value = String(s.words || 900); el.fVoice.value = s.voice || 'onyx'; el.fSysVoice.value = s.sysVoice || 'alloy'; $('fVoiceMode').value = s.voiceMode || 'narrator';
  el.fClass.value = s.clsSelect || ''; el.fClassCustom.hidden = el.fClass.value !== '__custom';
  if (!el.fClassCustom.hidden) el.fClassCustom.value = s.cls || '';
  el.fPremise.value = s.premise || ''; el.fTone.value = s.tone || 'gritty'; el.fStyle.value = s.style || 'lean'; $('fPov').value = s.pov || 'first'; $('fFlavor').value = s.flavor || 'custom'; el.fRating.value = s.rating || 'r'; el.fRomance.value = s.romance || 'off';
  for (const b of enemyBoxes()) b.checked = (s.enemies || []).includes(b.value);
  if (s.ratingPick) el.fRating.value = s.ratingPick === 'pg' ? 'r' : s.ratingPick;
  if (s.romancePick) el.fRomance.value = s.romancePick;
  el.fSysName.value = s.sysSelect || 'The System'; el.fSysNameCustom.hidden = el.fSysName.value !== '__custom';
  if (!el.fSysNameCustom.hidden) el.fSysNameCustom.value = s.systemName || '';
  el.fPersonality.value = s.personality || 'auto';
  el.fCompanion.value = s.companion || 'none'; el.fCompanionDesc.hidden = el.fCompanion.value !== 'start'; el.fCompanionDesc.value = s.companionDesc || '';
  for (const m of s.party || []) addMember(m);
  el.fTurns.checked = Boolean(s.turns); el.fNotes.value = s.notes || ''; $('fAvoid').value = s.avoidNames || ''; syncCount(); el.fAutoPoints.checked = Boolean(s.autoPoints);
  el.advanced.open = Boolean(s.advancedOpen);
  syncWorld();
}

// ---------- play view ----------
async function openRun(id) {
  try {
    status('Loading…', true);
    const { run } = await get(`/api/forge/run?id=${id}`);
    S.run = run; showRun(); status('');
    document.getElementById(`ch-${latest().n}`)?.scrollIntoView({ block: 'start' });
  } catch (e) { status(''); toast(e.message, true); location.hash = ''; }
}
function showRun() {
  el.home.hidden = true; el.play.hidden = false;
  document.body.classList.add('playing-view');
  render();
}
function render() {
  const run = S.run, last = latest();
  document.title = `${run.title} · Story Forge`;
  el.runTitle.textContent = run.title;
  el.runMeta.textContent = `[ ${WORLD_NAMES[run.setup.world] || 'Apocalypse'} · ${run.chapters.length} chapter${run.chapters.length === 1 ? '' : 's'} ]`;
  el.chapters.replaceChildren(...run.chapters.map(renderChapter));
  renderSheet();
  const pending = !last.decision;
  el.decision.hidden = !pending || S.busy;
  el.writing.hidden = !S.busy;
  el.styleSel.value = run.setup.style || 'lean';
  const who = last.decider;
  el.decisionTitle.textContent = who ? `${who}’s call: what do you do?` : 'What do you do?';
  el.steerChip.hidden = !run.pending?.steer;
  el.steerText.textContent = run.pending?.steer || '';
  el.ideasBtn.disabled = S.busy || !S.configured;
  const pts = last.sheet.unspent_points || 0;
  el.pointsBadge.hidden = !pts; el.pointsBadge.textContent = pts;
  el.statusBtn.title = pts ? `${pts} stat point${pts === 1 ? '' : 's'} to spend` : 'Open your status screen';
  if (!el.pause.hidden) renderPause();
  if (pending) {
    el.choices.replaceChildren(...last.choices.map((c, i) => h('button', {
      class: 'choice', type: 'button', disabled: S.busy || !S.configured, onclick: () => choose({ index: i }),
    }, h('span', { class: 'key' }, String(i + 1)), h('span', {}, c))));
  }
  for (const x of el.customForm.elements) x.disabled = S.busy || !S.configured;
  el.rerollBtn.disabled = S.busy || !S.configured;
  el.narrateBtn.hidden = has(last, 'c') || !S.configured;
  el.narrateBtn.disabled = S.narrating;
  el.narrateBtn.textContent = S.narrating ? '🔊 Recording…' : '🔊 Narrate this chapter';
  const anyAudio = run.chapters.some(c => has(c, 'c'));
  el.audiobookBtn.disabled = !anyAudio;
  highlight();
}
function renderChapter(c) {
  const body = [];
  for (const s of c.segments) {
    if (s.kind === 'system') body.push(h('div', { class: 'sysbox' }, h('span', { class: 'sys-label' }, sysName()), s.text));
    else if (s.kind === 'thought') {
      const line = h('p', { class: 'thought' }, s.text);
      const lastBlock = body.at(-1);
      if (lastBlock?.classList?.contains('prose')) lastBlock.append(line); else body.push(h('div', { class: 'prose' }, line));
    }
    else if (s.kind === 'dialogue') {
      const line = h('p', { class: 'line' }, h('span', { class: 'spk' }, s.speaker), `“${s.text}”`);
      const lastBlock = body.at(-1);
      if (lastBlock?.classList?.contains('prose')) lastBlock.append(line); else body.push(h('div', { class: 'prose' }, line));
    }
    else body.push(h('div', { class: 'prose' }, ...s.text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => h('p', {}, p))));
  }
  return h('section', { class: 'chapter', id: `ch-${c.n}` },
    h('div', { class: 'chapter-head' },
      h('span', { class: 'chapter-num' }, `Chapter ${c.n}`),
      h('h2', {}, c.title),
      has(c, 'c') ? h('button', { class: 'btn small chapter-play', type: 'button', onclick: () => playChapter(c) }, '▶ Play') : null),
    ...body,
    rateBox(c),
    c.decision ? h('div', { class: 'chose' }, h('b', {}, c.decision.by && c.decision.by !== S.run.setup.name ? `${c.decision.by} chose` : 'You chose'), h('span', {}, c.decision.text)) : null,
  );
}
// ---------- start over with the same settings ----------
$('startOverBtn').addEventListener('click', () => {
  if (!S.run) return;
  const s = S.run.setup;
  const hasOpt = (sel, v) => [...sel.options].some(o => o.value === v);
  pref.set('lastSetup', {
    ...s, clsSelect: !s.cls ? '' : hasOpt(el.fClass, s.cls) ? s.cls : '__custom',
    sysSelect: hasOpt(el.fSysName, s.systemName || 'The System') ? (s.systemName || 'The System') : '__custom',
    ratingPick: s.rating, romancePick: s.romance, flavor: s.flavor || 'custom', advancedOpen: true,
  });
  location.hash = '';
  setTimeout(() => {
    restoreSetup();
    el.newForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Your settings are loaded. Change anything you want, then start again. The old story is still saved under My runs.');
  }, 50);
});
// ---------- beginner quick start ----------
$('beginnerBtn').addEventListener('click', () => {
  el.fWorld.value = 'earth'; syncWorld();
  $('fFlavor').value = 'crawler'; for (const [id, v] of Object.entries(FLAVORS.crawler)) $(id).value = v;
  el.fStyle.value = 'balanced'; $('fFlavor').value = 'custom';
  el.fName.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.fName.focus(), 400);
  toast('Beginner setup loaded. Type your name (and your town if you want), then hit start.');
});
// ---------- story flavor presets ----------
const FLAVORS = {
  crawler: { fPov: 'first', fTone: 'darkcomedy', fPersonality: 'snarky', fStyle: 'lean' },
  hunter: { fPov: 'third', fTone: 'epic', fPersonality: 'cold', fStyle: 'balanced' },
};
$('fFlavor').addEventListener('change', () => {
  const f = FLAVORS[$('fFlavor').value];
  if (f) for (const [id, v] of Object.entries(f)) $(id).value = v;
});
for (const id of ['fPov', 'fTone', 'fPersonality', 'fStyle']) $(id).addEventListener('change', () => {
  const f = FLAVORS[$('fFlavor').value];
  if (f && f[id] !== $(id).value) $('fFlavor').value = 'custom';
});
if (!pref.get('flavorSet', false)) { const f = FLAVORS.crawler; for (const [id, v] of Object.entries(f)) $(id).value = v; }
// ---------- chapter rating (beta) ----------
const rateKey = c => `${S.run.id}:${c.n}`;
function rateBox(c) {
  const done = pref.get('rated', {})[rateKey(c)];
  if (done) return h('div', { class: 'rate done' }, done === 'up' ? '👍 Thanks, glad that one worked.' : '👎 Thanks, that helps us fix it.');
  const send = async (vote, note = '') => {
    try {
      await post('/api/rate', { vote, note, run: S.run.title, chapter: c.n, title: c.title });
      pref.set('rated', { ...pref.get('rated', {}), [rateKey(c)]: vote });
      if (S.rateOpen === rateKey(c)) S.rateOpen = null;
      box.replaceWith(rateBox(c));
    } catch (err) { toast(err.message, true); }
  };
  const box = h('div', { class: 'rate' });
  if (S.rateOpen === rateKey(c)) {
    const note = h('textarea', { rows: 3, maxlength: 1500, placeholder: 'What would have made it better? (optional)', 'aria-label': 'What would have made it better?' });
    box.append(note, h('div', { class: 'rate-row' },
      h('button', { class: 'btn primary small', type: 'button', onclick: () => send('down', note.value) }, 'Send'),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => send('down') }, 'Skip')));
    setTimeout(() => note.focus(), 0);
  } else {
    box.append(h('span', { class: 'rate-q' }, 'How was this chapter?'),
      h('button', { class: 'btn small', type: 'button', 'aria-label': 'Thumbs up', onclick: () => send('up') }, '👍'),
      h('button', { class: 'btn small', type: 'button', 'aria-label': 'Thumbs down', onclick: () => { S.rateOpen = rateKey(c); box.replaceWith(rateBox(c)); } }, '👎'));
  }
  return box;
}
function renderSheet() {
  const chs = S.run.chapters, s = latest().sheet, prev = chs.length > 1 ? chs.at(-2).sheet : null;
  const diff = (a, b) => {
    if (b == null || a === b) return null;
    return h('span', { class: a > b ? 'up' : 'down' }, `${a > b ? '+' : '−'}${Math.abs(a - b)}`);
  };
  const meter = (label, v, max, cls) => {
    const fill = h('div', { class: `meter-fill ${cls}` });
    fill.style.width = `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
    return h('div', { class: 'meter' }, h('div', { class: 'meter-top' }, h('span', {}, label), h('span', {}, `${v} / ${max}`)), h('div', { class: 'meter-bar' }, fill));
  };
  const prevSkills = new Set((prev?.skills || []).map(k => k.name + '|' + k.rank));
  const prevItems = new Set(prev?.inventory || []);
  const prevTitles = new Set(prev?.titles || []);
  const isNew = (set, key) => prev && !set.has(key) ? h('span', { class: 'new' }, 'NEW') : null;
  el.sheet.replaceChildren(...[
    h('div', { class: 'eyebrow' }, '[ STATUS ]'),
    h('div', { class: 'who' }, s.name),
    h('div', { class: 'cls' }, s.class, ' · ', h('span', { class: 'lvl' }, `Level ${s.level}`), diff(s.level, prev?.level)),
    meter('Health', s.health, s.max_health, 'fill-hp'),
    meter('Energy', s.energy, s.max_energy, 'fill-en'),
    meter('Experience', s.xp, s.xp_to_next, 'fill-xp'),
    s.condition && s.condition.toLowerCase() !== 'healthy' ? h('div', { class: 'skill-desc' }, `Condition: ${s.condition}`) : null,
    h('h3', {}, 'Stats'),
    h('div', { class: 'stats' }, ...Object.entries(s.stats).flatMap(([k, v]) => [h('span', { class: 'k' }, k), h('span', { class: 'v' }, v, diff(v, prev?.stats?.[k]))])),
    h('h3', {}, 'Skills'),
    s.skills.length ? h('ul', {}, ...s.skills.map(k => h('li', {},
      h('span', { class: 'skill-name' }, k.name), k.rank ? h('span', { class: 'skill-rank' }, k.rank) : null, isNew(prevSkills, k.name + '|' + k.rank),
      k.description ? h('div', { class: 'skill-desc' }, k.description) : null))) : h('div', { class: 'empty' }, 'None yet'),
    h('h3', {}, 'Inventory'),
    s.inventory.length ? h('ul', {}, ...s.inventory.map(x => h('li', {}, x, isNew(prevItems, x)))) : h('div', { class: 'empty' }, 'Empty'),
    s.titles.length ? h('h3', {}, 'Titles') : null,
    s.titles.length ? h('ul', {}, ...s.titles.map(x => h('li', {}, x, isNew(prevTitles, x)))) : null,
    meter('Authority', s.authority || 0, 100, 'fill-auth'),
    s.patrons?.length ? h('h3', {}, 'Patrons') : null,
    s.patrons?.length ? h('ul', {}, ...s.patrons.map(x => h('li', {}, x))) : null,
    s.companions?.length ? h('h3', {}, 'Companions') : null,
    ...(s.companions || []).map(companionLine),
    Object.values(s.equipment || {}).some(Boolean) ? h('h3', {}, 'Equipped') : null,
    Object.values(s.equipment || {}).some(Boolean) ? h('ul', {}, ...SLOTS.filter(k => s.equipment[k]).map(k => h('li', {}, h('span', { class: 'skill-desc' }, `${slotName(k)}: `), s.equipment[k]))) : null,
    h('button', { class: 'btn sheet-open', type: 'button', onclick: () => openPause() }, s.unspent_points ? `⏸ Status · ${s.unspent_points} points to spend` : '⏸ Open status screen'),
  ].filter(Boolean));
}
const sysName = () => S.run?.setup?.systemName || 'The System';
function companionLine(c) {
  const bond = h('div'); bond.style.width = `${Math.max(0, Math.min(100, c.bond))}%`;
  return h('div', { class: 'comp' },
    h('div', { class: 'comp-top' }, h('span', { class: 'comp-name' }, c.name), h('span', { class: 'skill-desc' }, `Lv ${c.level}`)),
    h('div', { class: 'skill-desc' }, [c.kind, c.role].filter(Boolean).join(' · ')),
    h('div', { class: 'bond', title: `Bond ${c.bond}/100` }, bond));
}
el.renameBtn.addEventListener('click', async () => {
  const t = await renameRun(S.run.id, S.run.title);
  if (t) { S.run.title = t; render(); }
});
el.sheetToggle.addEventListener('click', () => el.play.classList.toggle('sheet-closed'));
if (matchMedia('(max-width: 900px)').matches) el.play.classList.add('sheet-closed');

// ---------- story actions ----------
async function choose(decision) {
  if (S.busy || !S.run) return;
  stopListening();
  if (S.mode === 'live') stopAudio();
  S.busy = true;
  S.ideas = null; el.ideasPanel.hidden = true;
  const n = latest().n + 1;
  el.writingText.textContent = decision.custom ? `“${decision.custom}” … the System is writing chapter ${n}` : `The System is writing chapter ${n}…`;
  render();
  el.writing.scrollIntoView({ behavior: 'smooth', block: 'center' });
  status(`Writing chapter ${n}…`, true);
  try {
    const { run } = await post('/api/forge/choose', { id: S.run.id, ...decision });
    S.run = run; el.customInput.value = '';
    S.busy = false; render(); afterChapter();
  } catch (e) {
    S.busy = false; render(); status(''); toast(`${e.message} Your choice wasn’t used, so you can pick again.`, true);
  }
}
async function reroll() {
  if (S.busy) return;
  if (!confirm('Rewrite this chapter from scratch? The same decision is kept; the new version replaces this one.' + (S.run.pending?.actions?.length ? '\n\nStat points and gear changes you made after this chapter will be undone.' : ''))) return;
  stopAudio(); stopListening();
  S.busy = true; el.writingText.textContent = 'Rewriting the chapter…';
  render(); status('Rewriting…', true);
  try {
    const { run } = await post('/api/forge/reroll', { id: S.run.id });
    S.run = run; S.busy = false; render(); afterChapter();
  } catch (e) { S.busy = false; render(); status(''); toast(e.message, true); }
}
function afterChapter() {
  const c = latest();
  status('Ready');
  document.getElementById(`ch-${c.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (el.autoNarrate.checked) narrateLatest(true);
}
async function narrate(n, withChoices) {
  const { run } = await post('/api/forge/narrate', { id: S.run.id, chapter: n, choices: withChoices });
  if (S.run && run.id === S.run.id) { S.run = run; render(); }
}
async function narrateLatest(autoplay) {
  if (S.narrating || !S.run) return;
  const c = latest(), runId = S.run.id;
  S.narrating = true; render();
  status(`Recording chapter ${c.n} narration…`, true);
  try {
    await narrate(c.n, true);
    status('Ready');
    if (autoplay && S.run?.id === runId && latest().uid === c.uid && !c.decision) playChapter(latest(), 'live');
  } catch (e) { status(''); toast(e.message, true); }
  finally { S.narrating = false; if (S.run) render(); }
}
el.narrateBtn.addEventListener('click', () => narrateLatest(true));
el.rerollBtn.addEventListener('click', reroll);
el.customForm.addEventListener('submit', e => {
  e.preventDefault();
  const v = el.customInput.value.trim();
  if (!v) { el.customInput.focus(); return toast('Describe what you do.'); }
  choose({ custom: v });
});

// ---------- player ----------
function setQueue(items, mode) {
  S.queue = items; S.mode = mode; S.qi = -1; next();
}
function next() {
  S.qi++;
  const item = S.queue[S.qi];
  if (!item) return queueEnded();
  el.audio.src = item.url;
  el.plNow.textContent = item.label;
  const after = S.queue[S.qi + 1];
  el.plNext.textContent = after ? `Next: ${after.label}` : '';
  el.plSkip.hidden = !after;
  highlight();
  el.audio.play().catch(e => { if (e.name === 'NotAllowedError') toast('Press play to start the narration.'); });
}
function stopAudio() { el.audio.pause(); S.queue = []; S.qi = -1; S.mode = null; el.plSkip.hidden = true; el.plNext.textContent = ''; highlight(); }
function highlight() {
  const cur = S.queue[S.qi];
  document.querySelectorAll('.chapter.playing').forEach(n => n.classList.remove('playing'));
  if (cur?.n) document.getElementById(`ch-${cur.n}`)?.classList.add('playing');
}
function queueEnded() {
  const mode = S.mode;
  S.mode = null; el.plNext.textContent = ''; el.plSkip.hidden = true; highlight();
  if (mode === 'live' && el.handsFree.checked && S.run && !latest().decision && !S.busy) listenForChoice();
}
el.audio.addEventListener('ended', () => { if (S.mode) next(); });
el.audio.addEventListener('error', () => { if (S.mode) { toast('Couldn’t play that part. Skipping.', true); next(); } });
el.plSkip.addEventListener('click', () => next());

function playChapter(c, mode = 'single') {
  const items = [{ url: audioUrl(`c-${c.uid}.mp3`), label: `Chapter ${c.n}: ${c.title}`, n: c.n }];
  const isLatest = c.uid === latest().uid;
  if (isLatest && !c.decision && has(c, 'q')) items.push({ url: audioUrl(`q-${c.uid}.mp3`), label: 'What do you do?', n: c.n });
  setQueue(items, isLatest && !c.decision ? 'live' : mode);
}
async function listenAll() {
  const missing = S.run.chapters.filter(c => !has(c, 'c'));
  if (missing.length) {
    const ok = confirm(`${missing.length} chapter${missing.length === 1 ? ' hasn’t' : 's haven’t'} been narrated yet. Record ${missing.length === 1 ? 'it' : 'them'} now? (A few cents each.)\n\nCancel plays only what’s already recorded.`);
    if (ok) {
      try {
        for (const c of missing) {
          status(`Recording chapter ${c.n} of ${S.run.chapters.length}…`, true);
          S.narrating = true; await narrate(c.n, c.uid === latest().uid);
        }
        status('Ready');
      } catch (e) { status(''); toast(e.message, true); }
      finally { S.narrating = false; render(); }
    }
  }
  const items = [];
  for (const c of S.run.chapters) {
    if (has(c, 'c')) items.push({ url: audioUrl(`c-${c.uid}.mp3`), label: `Chapter ${c.n}: ${c.title}`, n: c.n });
    if (c.decision && has(c, 'd')) items.push({ url: audioUrl(`d-${c.uid}.mp3`), label: `You chose: ${c.decision.text}`, n: c.n });
  }
  const last = latest();
  if (!last.decision && has(last, 'q')) items.push({ url: audioUrl(`q-${last.uid}.mp3`), label: 'What do you do?', n: last.n });
  if (!items.length) return toast('Nothing has been narrated yet.');
  setQueue(items, !last.decision ? 'live' : 'replay');
}
el.listenAllBtn.addEventListener('click', listenAll);
el.audiobookBtn.addEventListener('click', () => { location.href = `/api/forge/audiobook?id=${encodeURIComponent(S.run.id)}`; });
el.textBtn.addEventListener('click', () => {
  const r = S.run, lines = [r.title, '='.repeat(r.title.length), ''];
  for (const c of r.chapters) {
    lines.push(`Chapter ${c.n}: ${c.title}`, '');
    for (const s of c.segments) lines.push(s.kind === 'system' ? `[ ${s.text.replace(/\n/g, ' | ')} ]` : s.kind === 'dialogue' ? `${s.speaker}: “${s.text}”` : s.kind === 'thought' ? `_${s.text}_` : s.text, '');
    if (c.decision) lines.push(`>> You chose: ${c.decision.text}`, '');
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story-forge'}.txt` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- voice ----------
function stopListening() {
  if (S.rec) { try { S.rec.abort(); } catch {} S.rec = null; }
  el.micBtn.classList.remove('mic-live');
}
function listen(onText, label) {
  stopListening();
  const rec = new Speech();
  rec.lang = navigator.language || 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
  let heard = false;
  rec.onresult = e => { heard = true; onText(e.results[0][0].transcript); };
  rec.onerror = e => { if (e.error === 'not-allowed') toast('Microphone access is blocked. Allow it in Chrome’s address bar to use voice.', true); };
  rec.onend = () => {
    if (S.rec !== rec) return;
    S.rec = null; el.micBtn.classList.remove('mic-live');
    if (el.status.textContent.startsWith('🎙')) status(heard ? '' : 'Didn’t catch that. Tap a choice or the mic.');
  };
  S.rec = rec; el.micBtn.classList.add('mic-live');
  status(label);
  try { rec.start(); } catch { stopListening(); }
}
const NUMS = [['1', 'one', 'first', 'won', 'a'], ['2', 'two', 'second', 'to', 'too', 'b', 'bee'], ['3', 'three', 'third', 'tree', 'c', 'see', 'sea'], ['4', 'four', 'fourth', 'for', 'fore', 'd', 'dee']];
function parseSpoken(t) {
  const s = t.toLowerCase().replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\b(option|number|choice|choose|pick|i'll|ill|i|go|with|the|take|do|let's|lets)\b/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(first|second|third|fourth|last) one$/, '$1');
  if (s === 'last') return { index: Math.max(0, (S.run ? latest().choices.length : 4) - 1) };
  const i = NUMS.findIndex(words => words.includes(s));
  return i >= 0 ? { index: i } : { custom: t.trim() };
}
function listenForChoice() {
  if (!Speech) return;
  listen(text => {
    const d = parseSpoken(text);
    if (d.index != null) { toast(`Heard: option ${d.index + 1}`); choose(d); }
    else if (d.custom.length >= 3) { el.customInput.value = d.custom; toast(`Heard: “${d.custom}”`); choose(d); }
  }, '🎙 Listening… say 1, 2, 3, 4 or your own move');
}
el.micBtn.addEventListener('click', () => {
  if (S.rec) return stopListening();
  listen(text => { el.customInput.value = text; el.customInput.focus(); }, '🎙 Listening…');
});

// ---------- ideas & steering ----------
async function setSteer(text) {
  try {
    const { run } = await post('/api/forge/settings', { id: S.run.id, steer: text });
    S.run = { ...S.run, pending: run.pending }; render();
    if (text) { el.ideasPanel.hidden = true; toast('Got it. The story will work that in.'); }
  } catch (e) { toast(e.message, true); }
}
el.ideasBtn.addEventListener('click', async () => {
  if (!el.ideasPanel.hidden && S.ideas) { el.ideasPanel.hidden = true; return; }
  el.ideasPanel.hidden = false;
  el.ideasList.replaceChildren(h('div', { class: 'writing' }, h('span', { class: 'pulse' }), 'Brainstorming where this could go…'));
  el.ideasBtn.disabled = true;
  try {
    const { ideas } = await post('/api/forge/ideas', { id: S.run.id });
    S.ideas = ideas;
    el.ideasList.replaceChildren(...ideas.map(i => h('button', { class: 'idea', type: 'button', onclick: () => setSteer(`${i.title}: ${i.pitch}`) }, h('b', {}, i.title), h('span', {}, i.pitch))));
  } catch (e) { el.ideasList.replaceChildren(); toast(e.message, true); }
  finally { el.ideasBtn.disabled = S.busy || !S.configured; }
});
el.steerForm.addEventListener('submit', e => {
  e.preventDefault();
  const v = el.steerInput.value.trim();
  if (!v) return el.steerInput.focus();
  el.steerInput.value = ''; setSteer(v);
});
el.steerClear.addEventListener('click', () => setSteer(''));

// ---------- pause screen ----------
function openPause(tab) {
  if (tab) S.tab = tab;
  S.alloc = {};
  el.pause.hidden = false;
  document.body.style.overflow = 'hidden';
  renderPause();
  el.pauseClose.focus();
}
function closePause() {
  el.pause.hidden = true; document.body.style.overflow = '';
  el.statusBtn.focus();
}
el.statusBtn.addEventListener('click', () => openPause());
el.styleSel.addEventListener('change', () => sheetAction('/api/forge/settings', { style: el.styleSel.value }, 'Style updated. It kicks in from the next chapter.'));
el.pauseClose.addEventListener('click', closePause);
el.pause.addEventListener('click', e => { if (e.target === el.pause) closePause(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.pause.hidden) closePause(); });
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { S.tab = t.dataset.tab; renderPause(); });

async function sheetAction(path, body, okMsg) {
  try {
    const { run } = await post(path, { id: S.run.id, ...body });
    S.run = run; S.alloc = {}; render(); renderPause();
    if (okMsg) toast(okMsg);
  } catch (e) { toast(e.message, true); }
}
function renderPause() {
  if (!S.run) return;
  const sh = latest().sheet;
  el.pauseTitle.textContent = `${sh.name} · Level ${sh.level} ${sh.class}`;
  document.getElementById('messagesTab').hidden = S.run.setup.family !== 'sanctuary';
  if (S.tab === 'messages' && S.run.setup.family !== 'sanctuary') S.tab = 'character';
  for (const t of document.querySelectorAll('.tab')) { t.classList.toggle('on', t.dataset.tab === S.tab); t.setAttribute('aria-selected', t.dataset.tab === S.tab); }
  const viewsExtra = { voices: pauseVoices };
  const views = { ...viewsExtra, character: pauseCharacter, gear: pauseGear, party: pauseParty, codex: pauseCodex, vision: pauseVision, messages: pauseMessages };
  el.pauseBody.replaceChildren(...(views[S.tab] || pauseCharacter)(sh).filter(Boolean));
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function figure(eq, size = 'big') {
  // A simple silhouette; equipped slots light up.
  const on = k => (eq?.[k] ? '#5cc8ff' : '#2a3a55'), base = '#1b2840';
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg xmlns="${SVG_NS}" viewBox="0 0 200 300" role="img" aria-label="Character figure">
    <circle cx="100" cy="42" r="24" fill="${base}"/>${eq?.head ? `<path d="M74 40a26 26 0 0 1 52 0v6H74z" fill="${on('head')}" opacity=".9"/>` : ''}
    <rect x="70" y="72" width="60" height="86" rx="14" fill="${eq?.chest ? on('chest') : base}" opacity="${eq?.chest ? .85 : 1}"/>
    <rect x="44" y="76" width="22" height="76" rx="10" fill="${base}"/><rect x="134" y="76" width="22" height="76" rx="10" fill="${base}"/>
    <circle cx="55" cy="160" r="11" fill="${on('hands')}"/><circle cx="145" cy="160" r="11" fill="${on('hands')}"/>
    <rect x="74" y="162" width="23" height="92" rx="10" fill="${eq?.legs ? on('legs') : base}" opacity="${eq?.legs ? .85 : 1}"/><rect x="103" y="162" width="23" height="92" rx="10" fill="${eq?.legs ? on('legs') : base}" opacity="${eq?.legs ? .85 : 1}"/>
    <rect x="68" y="254" width="32" height="16" rx="7" fill="${on('feet')}"/><rect x="100" y="254" width="32" height="16" rx="7" fill="${on('feet')}"/>
    ${eq?.main_hand ? `<rect x="141" y="70" width="8" height="110" rx="3" fill="${on('main_hand')}" transform="rotate(12 145 160)"/>` : ''}
    ${eq?.off_hand ? `<path d="M30 140h34v26c0 14-17 22-17 22s-17-8-17-22z" fill="${on('off_hand')}" opacity=".9"/>` : ''}
    ${eq?.accessory ? `<circle cx="100" cy="82" r="6" fill="#f2c94c"/>` : ''}
  </svg>`;
  wrap.className = size === 'big' ? 'doll-fig' : '';
  return wrap;
}
function pauseCharacter(sh) {
  const run = S.run, spent = Object.values(S.alloc).reduce((a, b) => a + b, 0), left = (sh.unspent_points || 0) - spent;
  const portrait = h('div', { class: 'portrait' });
  if (run.portrait) portrait.append(h('img', { src: `/api/forge/image?id=${run.id}&file=${run.portrait}`, alt: `Portrait of ${sh.name}` }));
  else portrait.append(figure(sh.equipment, 'small').firstChild);
  const paintBtn = h('button', { class: 'btn small', type: 'button', disabled: S.painting || !S.configured, onclick: paint },
    S.painting ? 'Painting…' : run.portrait ? '🎨 Repaint portrait' : '🎨 Paint my character');
  const rows = STATS.flatMap(k => {
    const add = S.alloc[k] || 0;
    return [
      h('span', { class: 'k' }, k),
      h('span', { class: 'v' }, sh.stats[k] + add),
      h('span', { class: 'plus' }, add ? `+${add}` : ''),
      sh.unspent_points ? h('span', { class: 'step' },
        h('button', { class: 'btn', type: 'button', 'aria-label': `Remove point from ${k}`, disabled: !add, onclick: () => { S.alloc[k] = add - 1; renderPause(); } }, '−'),
        h('button', { class: 'btn', type: 'button', 'aria-label': `Add point to ${k}`, disabled: left <= 0, onclick: () => { S.alloc[k] = add + 1; renderPause(); } }, '+')) : h('span'),
    ];
  });
  const auto = h('input', { type: 'checkbox' }); auto.checked = Boolean(run.setup.autoPoints);
  auto.addEventListener('change', () => sheetAction('/api/forge/settings', { autoPoints: auto.checked }, auto.checked ? 'Future points will be auto-assigned to your build.' : 'You’ll assign points yourself.'));
  return [h('div', { class: 'char-grid' },
    h('div', {},
      portrait,
      h('div', { class: 'portrait-cap' }, run.portrait ? 'Repaint after big changes: new gear, class or scars.' : 'An AI painting of your hero (about 1–4¢).'),
      paintBtn,
      sh.appearance ? h('p', { class: 'appearance' }, sh.appearance) : null),
    h('div', {},
      h('div', { class: 'who-big' }, sh.name),
      h('div', { class: 'cls' }, `${sh.class} · `, h('span', { class: 'lvl' }, `Level ${sh.level}`), sh.condition ? ` · ${sh.condition}` : ''),
      meterEl('Health', sh.health, sh.max_health, 'fill-hp'), meterEl('Energy', sh.energy, sh.max_energy, 'fill-en'), meterEl('Experience', sh.xp, sh.xp_to_next, 'fill-xp'),
      meterEl(`Authority with ${sysName()}`, sh.authority || 0, 100, 'fill-auth'),
      h('div', { class: 'skill-desc' }, authorityTier(sh.authority || 0)),
      sh.patrons?.length ? h('h3', {}, 'Patrons') : null,
      sh.patrons?.length ? h('ul', {}, ...sh.patrons.map(x => h('li', {}, x))) : null,
      h('h3', {}, 'Stats'),
      sh.unspent_points ? h('div', { class: 'points-bar' },
        h('span', { class: 'grow' }, h('b', {}, left), ` point${left === 1 ? '' : 's'} to spend`),
        h('button', { class: 'btn small', type: 'button', disabled: !spent, onclick: () => { S.alloc = {}; renderPause(); } }, 'Reset'),
        h('button', { class: 'btn primary small', type: 'button', disabled: !spent, onclick: () => sheetAction('/api/forge/allocate', { add: S.alloc }, 'Points locked in. The next chapter will feel it.') }, 'Confirm')) : null,
      h('div', { class: 'alloc' }, ...rows),
      h('label', { class: 'toggle inline' }, auto, ' Auto-assign future points to my build'),
      h('h3', {}, 'Skills'),
      sh.skills.length ? h('ul', {}, ...sh.skills.map(k => h('li', {}, h('span', { class: 'skill-name' }, k.name), k.rank ? h('span', { class: 'skill-rank' }, k.rank) : null, k.description ? h('div', { class: 'skill-desc' }, k.description) : null))) : h('div', { class: 'empty' }, 'None yet'),
      sh.titles.length ? h('h3', {}, 'Titles') : null,
      sh.titles.length ? h('ul', {}, ...sh.titles.map(t => h('li', {}, t))) : null,
    ))];
}
function authorityTier(a) {
  if (a >= 75) return 'It reacts to you within your territory.';
  if (a >= 50) return 'It allows small negotiations.';
  if (a >= 25) return 'It offers you choices of reward.';
  if (a >= 10) return 'It answers simple questions.';
  return 'It does not know your name yet.';
}
function meterEl(label, v, max, cls) {
  const fill = h('div', { class: `meter-fill ${cls}` });
  fill.style.width = `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
  return h('div', { class: 'meter' }, h('div', { class: 'meter-top' }, h('span', {}, label), h('span', {}, `${v} / ${max}`)), h('div', { class: 'meter-bar' }, fill));
}
async function paint() {
  S.painting = true; renderPause(); status('Painting your character…', true);
  try { const { run } = await post('/api/forge/portrait', { id: S.run.id }); S.run = run; status('Ready'); toast('Portrait painted.'); }
  catch (e) { status(''); toast(e.message, true); }
  finally { S.painting = false; render(); renderPause(); }
}
function pauseGear(sh) {
  const eq = sh.equipment || {};
  const slot = k => h('div', { class: `slot${eq[k] ? ' filled' : ''}` },
    h('div', { class: 'slot-k' }, slotName(k), eq[k] ? h('button', { type: 'button', onclick: () => sheetAction('/api/forge/equip', { slot: k, item: null }, `Unequipped ${eq[k]}.`) }, 'unequip') : null),
    h('div', { class: `slot-v${eq[k] ? '' : ' empty'}` }, eq[k] || 'Empty'));
  const items = sh.inventory.map(item => {
    const equipped = SLOTS.filter(k => eq[k]);
    const sel = h('select', { 'aria-label': `What to do with ${item}` }, h('option', { value: '' }, 'Equip or use…'),
      h('optgroup', { label: 'Equip to' }, ...SLOTS.map(k => h('option', { value: `equip:${k}` }, `${slotName(k)}${eq[k] ? ` (swap ${eq[k]})` : ''}`))),
      h('optgroup', { label: 'Use on (mods, kits, boosters)' }, h('option', { value: 'use:self' }, 'Yourself'), ...equipped.map(k => h('option', { value: `use:${k}` }, eq[k]))));
    sel.addEventListener('change', () => {
      const [act, target] = sel.value.split(':');
      if (act === 'equip') sheetAction('/api/forge/equip', { slot: target, item }, `Equipped ${item}.`);
      if (act === 'use') sheetAction('/api/forge/use', { item, target }, `Used ${item}. The next chapter will show what it does.`);
    });
    return h('div', { class: 'item' }, h('div', { class: 'item-name' }, item), sel);
  });
  return [
    h('h3', {}, 'Equipped'),
    h('div', { class: 'doll' },
      h('div', { class: 'slots' }, ...['head', 'chest', 'legs', 'feet'].map(slot)),
      figure(eq),
      h('div', { class: 'slots' }, ...['main_hand', 'off_hand', 'hands', 'accessory'].map(slot))),
    h('div', { class: 'doll' }, h('div', { class: 'slot-wrap vehicle-row' }, slot('vehicle'))),
    h('h3', {}, `Inventory (${sh.inventory.length})`),
    items.length ? h('div', { class: 'inv' }, ...items) : h('div', { class: 'empty-state' }, 'Nothing carried yet. Loot finds its way to you.'),
    h('p', { class: 'hint' }, 'Equip gear, or use mod kits, enhancers and boosters on your gear or yourself. The next chapter resolves what happens and upgrades the item.'),
  ];
}
function pauseParty(sh) {
  const cs = sh.companions || [];
  if (!cs.length) {
    const s = S.run.setup;
    return [h('div', { class: 'empty-state' }, s.companion === 'open' ? 'No companion yet. The story is watching for the right moment.' : 'No companions yet.')];
  }
  return [h('div', { class: 'cards' }, ...cs.map(c => {
    const bond = h('div'); bond.style.width = `${Math.max(0, Math.min(100, c.bond))}%`;
    return h('div', { class: 'card' },
      h('div', { class: 'card-name' }, c.name),
      h('div', { class: 'card-sub' }, [c.kind, c.role, `Level ${c.level}`].filter(Boolean).join(' · ')),
      h('div', { class: 'meter-top' }, h('span', {}, 'Bond'), h('span', {}, `${c.bond} / 100`)),
      h('div', { class: 'bond' }, bond),
      c.condition ? h('div', { class: 'skill-desc' }, `Condition: ${c.condition}`) : null);
  }))];
}
function pauseVoices() {
  const st = S.run.setup;
  const nar = h('select', { 'aria-label': 'Narrator voice' }); fillVoices(nar, st.voice || 'onyx');
  const sys = h('select', { 'aria-label': 'System voice' }); fillVoices(sys, st.sysVoice || 'alloy');
  const chars = h('select', { 'aria-label': 'How characters are voiced' },
    h('option', { value: 'narrator' }, 'One narrator does all the voices (like an audiobook)'),
    h('option', { value: 'cast' }, 'Full cast: every character gets their own voice'));
  chars.value = st.voiceMode || (st.charVoices === false ? 'narrator' : 'cast');
  const save = () => sheetAction('/api/forge/settings', { voice: nar.value, sysVoice: sys.value, voiceMode: chars.value }, 'Voices saved. New narration will use them.');
  nar.addEventListener('change', save); sys.addEventListener('change', save); chars.addEventListener('change', save);
  const cast = Object.entries(S.run.cast || {});
  const last = latest();
  return [
    h('h3', {}, 'Voices'),
    h('div', { class: 'grid2' }, h('div', {}, h('label', {}, 'Narrator'), nar), h('div', {}, h('label', {}, `${sysName()}`), sys)),
    h('label', {}, 'Character voices'), chars,
    cast.length ? h('h3', {}, 'Character voices so far') : null,
    cast.length ? h('ul', {}, ...cast.map(([who, v]) => h('li', {}, `${who}: `, h('span', { class: 'skill-desc' }, (VOICE_OPTS.find(o => o[0] === v) || [v, v])[1])))) : null,
    h('h3', {}, 'Re-record'),
    h('p', { class: 'appearance' }, 'Changed the voices? Re-record the latest chapter to hear it with the new ones (a few cents).'),
    h('button', { class: 'btn small', type: 'button', disabled: S.narrating || !S.configured, onclick: async () => {
      closePause(); S.narrating = true; render(); status(`Re-recording chapter ${last.n}…`, true);
      try { await post('/api/forge/narrate', { id: S.run.id, chapter: last.n, choices: !last.decision, force: true }).then(r => { S.run = r.run; }); status('Ready'); playChapter(latest(), 'live'); }
      catch (e) { status(''); toast(e.message, true); }
      finally { S.narrating = false; render(); }
    } }, `🔊 Re-record chapter ${last.n}`),
  ].filter(Boolean);
}
function pauseVision() {
  const ta = h('textarea', { maxlength: 6000, 'aria-label': 'Story vision' });
  const av = h('input', { maxlength: 400, placeholder: 'e.g. Leah, Jacobs, Tara', 'aria-label': 'Names to keep out of the story' });
  av.value = S.run.setup.avoidNames || '';
  ta.value = S.run.setup.notes || '';
  const count = h('span', {}, ta.value.length.toLocaleString());
  ta.addEventListener('input', () => { count.textContent = ta.value.length.toLocaleString(); });
  return [h('div', { class: 'vision-edit' },
    h('p', { class: 'appearance' }, 'Your ideas for where this story goes. The game master follows it every chapter, and changes apply from the next one. Add new ideas any time.'),
    ta,
    h('div', { class: 'points-bar' }, h('span', { class: 'grow' }, count, ' / 6,000'),
      h('button', { class: 'btn primary small', type: 'button', onclick: () => sheetAction('/api/forge/settings', { notes: ta.value, avoidNames: av.value }, 'Saved. The next chapter will follow it.') }, 'Save'))),
    h('label', { class: 'avoid-label' }, 'Names to keep out of the story ', h('span', { class: 'opt' }, 'people you know, separated by commas')), av];
}
function pauseMessages(sh) {
  const inbox = S.run.chapters.flatMap(c => (c.inbox || []).map(m => ({ ...m, n: c.n, dir: 'in' })));
  const sent = (S.run.outbox || []).map(m => ({ from: `You → ${m.to}`, text: m.text, n: m.n, dir: 'out' }));
  const all = [...inbox, ...sent].sort((a, b) => a.n - b.n || (a.dir === 'in' ? -1 : 1));
  if (!sh.link_unlocked) {
    return [h('div', { class: 'empty-state' }, 'No way to reach Sanctuary yet. Survivors whisper that there is one, for those strong enough to earn it. Keep climbing.')];
  }
  const to = h('input', { type: 'text', maxlength: 60, placeholder: 'To (e.g. my girls)', 'aria-label': 'Message to' });
  to.value = S.run.setup.familyDesc || '';
  const text = h('textarea', { maxlength: 500, rows: 3, placeholder: 'Write something they’ll hear in Sanctuary…', 'aria-label': 'Message' });
  return [
    h('h3', {}, 'Sanctuary link'),
    all.length ? h('div', { class: 'msgs' }, ...all.map(m => h('div', { class: `msg ${m.dir}` },
      h('div', { class: 'msg-from' }, `${m.from} · chapter ${m.n}`), h('div', { class: 'msg-text' }, m.text)))) : h('div', { class: 'empty-state' }, 'The link is open. No messages yet.'),
    h('h3', {}, 'Send a message'),
    h('div', { class: 'compose' }, to, text,
      h('button', { class: 'btn primary small', type: 'button', onclick: () => {
        if (!text.value.trim()) return text.focus();
        sheetAction('/api/forge/message', { to: to.value, text: text.value }, 'Sent. Replies come back in the story.');
      } }, 'Send into Sanctuary')),
  ];
}
function renameCard() {
  const run = S.run, hero = run.setup.name, last = latest();
  const names = new Set();
  for (const e of last.codex || []) if (e.kind === 'person' || e.kind === 'creature') names.add(e.name);
  for (const c of last.sheet.companions || []) names.add(c.name);
  for (const c of run.chapters) for (const sg of c.segments) if (sg.kind === 'dialogue' && sg.speaker) names.add(sg.speaker);
  names.delete(hero);
  const list = [...names].filter(Boolean).sort();
  if (!list.length) return null;
  const sel = h('select', { 'aria-label': 'Character to rename' }, ...list.map(n => h('option', { value: n }, n)));
  const input = h('input', { maxlength: 40, placeholder: 'New name', 'aria-label': 'New name' });
  const sugg = h('div', { class: 'chips name-chips' });
  const suggest = async () => {
    sugg.replaceChildren(h('span', { class: 'hint' }, 'Thinking up names…'));
    try {
      const { names } = await post('/api/forge/names', { id: run.id, who: sel.value });
      sugg.replaceChildren(...names.map(n => h('button', { class: 'chip', type: 'button', title: n.why, onclick: () => { input.value = n.name; input.focus(); } }, n.name)));
    } catch (e) { sugg.replaceChildren(); toast(e.message, true); }
  };
  const apply = () => {
    const to = input.value.trim();
    if (!to) return input.focus();
    sheetAction('/api/forge/recast', { from: sel.value, to }, `Done. ${sel.value} is now ${to} everywhere, and the story will keep using ${to}.`);
  };
  return h('div', { class: 'card rename-card' },
    h('div', { class: 'card-name' }, 'Rename a character'),
    h('p', { class: 'appearance' }, 'Name sounds like someone you know, or just doesn’t fit? Change it. It updates the whole story and the old name never comes back. (Chapters already narrated keep the old name in the audio.)'),
    h('div', { class: 'custom' }, sel, input),
    h('div', { class: 'decision-foot' },
      h('button', { class: 'btn ghost small', type: 'button', onclick: suggest }, '💡 Suggest names'),
      h('button', { class: 'btn primary small', type: 'button', onclick: apply }, 'Rename')),
    sugg);
}
function pauseCodex() {
  const codex = latest().codex || [];
  const rc = renameCard();
  if (!codex.length) return [rc, h('div', { class: 'empty-state' }, 'Nothing discovered yet. People, creatures, factions and places you encounter will appear here.')];
  const groups = [['person', 'People'], ['creature', 'Creatures'], ['faction', 'Factions'], ['place', 'Places'], ['item', 'Items'], ['lore', 'Lore']];
  return [rc, ...groups.filter(([k]) => codex.some(e => e.kind === k)).map(([k, title]) => h('div', { class: 'codex-group' },
    h('h3', {}, title),
    ...codex.filter(e => e.kind === k).map(e => h('div', { class: 'codex-entry' }, h('b', {}, e.name), ' ', h('span', {}, e.note)))))];
}

// ---------- prefs & start ----------
el.autoNarrate.checked = pref.get('autoNarrate', true);
el.handsFree.checked = pref.get('handsFree', false) && Boolean(Speech);
el.autoNarrate.addEventListener('change', () => {
  pref.set('autoNarrate', el.autoNarrate.checked);
  if (!el.autoNarrate.checked && el.handsFree.checked) { el.handsFree.checked = false; pref.set('handsFree', false); }
});
el.handsFree.addEventListener('change', () => {
  pref.set('handsFree', el.handsFree.checked);
  if (el.handsFree.checked) {
    if (!el.autoNarrate.checked) { el.autoNarrate.checked = true; pref.set('autoNarrate', true); }
    toast('Hands-free on: after the choices are read, just say 1, 2, 3, 4 or your own move.');
  } else stopListening();
});
if (!Speech) { el.handsFreeWrap.hidden = true; } else { el.micBtn.hidden = false; }

(async function init() {
  restoreSetup();
  try {
    const st = await get('/api/status');
    S.configured = Boolean(st.configured); A.hosted = Boolean(st.hosted);
  } catch { toast('Can’t reach the Story Forge server. Is the launcher window still open?', true); }
  el.banner.hidden = S.configured || A.hosted;
  el.startBtn.disabled = !S.configured;
  if (A.hosted) {
    $$('studioLink').hidden = true;
    try { const me = await get('/api/auth/me'); A.user = me.user; } catch { return showJoin(); }
    afterSignIn();
  }
  route();
})();
