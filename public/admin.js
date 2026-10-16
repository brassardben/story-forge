'use strict';
const $ = id => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : String(kid));
  return n;
}
let toastTimer;
function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.classList.toggle('error', Boolean(err)); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000); }
const when = t => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const joinLink = c => `${location.origin}/forge?code=${encodeURIComponent(c)}`;
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch { prompt('Copy this:', text); }
}
function table(head, rows) {
  if (!rows.length) return h('p', { class: 'empty' }, 'Nothing yet.');
  return h('div', { class: 'table-wrap' }, h('table', { class: 'admin-table' },
    h('thead', {}, h('tr', {}, ...head.map(x => h('th', {}, x)))),
    h('tbody', {}, ...rows.map(r => h('tr', {}, ...r.map(c => h('td', {}, c)))))));
}

async function load() {
  const res = await fetch('/api/admin/overview');
  if (res.status === 401 || res.status === 403) { location.href = '/forge'; return; }
  const d = await res.json();
  const L = d.limits;
  $('limitsNote').textContent = `Weekly limits per tester: ${L.chapter} chapters, ${L.narration} narrations, ${L.portrait} portraits, ${L.ideas} idea pitches. Change them with LIMIT_* settings on the host.`;
  $('invites').replaceChildren(table(['Code', 'For', 'Used', 'Link'], d.invites.sort((a, b) => b.created - a.created).map(i => [
    h('b', { class: 'mono' }, i.code), i.note || '—', `${i.uses} / ${i.max}`,
    h('button', { class: 'btn small', type: 'button', onclick: () => copy(joinLink(i.code)) }, 'Copy invite link'),
  ])));
  const totals = { chapter: 0, narration: 0, portrait: 0 };
  $('users').replaceChildren(table(['Name', 'Joined', 'Last active', 'This week'], d.users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).map(u => {
    for (const k of Object.keys(totals)) totals[k] += u.usage?.[k] || 0;
    return [u.admin ? `${u.name} (you)` : u.name, when(u.created), when(u.lastSeen), `${u.usage?.chapter || 0} ch · ${u.usage?.narration || 0} narr · ${u.usage?.portrait || 0} img`];
  })));
  $('users').prepend(h('p', { class: 'hint' }, `${d.users.length} tester${d.users.length === 1 ? '' : 's'} · this week: ${totals.chapter} chapters, ${totals.narration} narrations, ${totals.portrait} portraits (rough cost ≈ $${(totals.chapter * 0.02 + totals.narration * 0.08 + totals.portrait * 0.04).toFixed(2)})`));
  $('feedback').replaceChildren(...(d.feedback.length ? d.feedback.map(f => h('div', { class: 'card fb' },
    h('div', { class: 'card-sub' }, `${f.from} · ${when(f.at)}${f.page ? ` · ${f.page}` : ''}`),
    h('div', { class: 'fb-text' }, f.text))) : [h('p', { class: 'empty' }, 'No feedback yet.')]));
}
$('inviteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const res = await fetch('/api/admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: $('iNote').value, max: Number($('iMax').value) }) });
  const d = await res.json();
  if (!res.ok) return toast(d.error || 'Could not create a code.', true);
  const box = $('newInvite');
  box.replaceChildren(h('div', { class: 'pcode' }, d.code), h('p', { class: 'hint' }, 'Share the link below. People who open it will have the code filled in for them.'),
    h('div', { class: 'custom' }, h('input', { value: joinLink(d.code), readonly: true, 'aria-label': 'Invite link' }), h('button', { class: 'btn primary', type: 'button', onclick: () => copy(joinLink(d.code)) }, 'Copy link')));
  box.hidden = false; $('iNote').value = '';
  load();
});
load();
