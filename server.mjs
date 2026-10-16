import http from 'node:http';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createForge } from './forge.mjs';
import { createAuth } from './auth.mjs';
import { createBeta } from './beta.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(root, '../../.env.local');
let key = process.env.OPENAI_API_KEY;
if (!key) {
  try {
    const env = await readFile(envPath, 'utf8');
    const value = env.match(/^\s*OPENAI_API_KEY\s*=\s*(.*?)\s*$/m)?.[1];
    key = value?.replace(/^(['"])(.*)\1$/, '$2');
  } catch {}
}
const port = Number(process.env.PORT || 3210);
// HOSTED=1 runs Story Forge as an online beta: invite codes, one save folder per player, weekly limits.
const hosted = process.env.HOSTED === '1';
const dataDir = process.env.DATA_DIR || root;
const logFile = path.join(dataDir, 'errors.log');
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const limits = { chapter: num(process.env.LIMIT_CHAPTERS, 30), narration: num(process.env.LIMIT_NARRATION, 30), portrait: num(process.env.LIMIT_PORTRAITS, 3), ideas: num(process.env.LIMIT_IDEAS, 15) };
await mkdir(dataDir, { recursive: true });
const auth = hosted ? await createAuth({ dataDir, adminCode: process.env.ADMIN_CODE, limits, secure: process.env.INSECURE_COOKIES !== '1' }) : null;
const beta = await createBeta({ dataDir });
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
let busy = false;
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function fail(message, status=400) { throw Object.assign(new Error(message), { status }); }
function str(value, max, name, required=true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Please enter ${name} (up to ${max.toLocaleString()} characters).`);
  return value.trim();
}
async function api(endpoint, body) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(`https://api.openai.com/v1/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
    } catch (e) {
      // Timeouts and dropped connections: retry a couple of times.
      appendFile(logFile, `${new Date().toISOString()} OpenAI ${endpoint} network: ${e.message}\n`).catch(() => {});
      if (attempt < 2) continue;
      fail('OpenAI took too long to respond. Please try again.', 504);
    }
    if (response.ok) return response;
    const data = await response.json().catch(() => ({}));
    const code = data.error?.code, msg = data.error?.message || '';
    console.error(`OpenAI ${endpoint} error ${response.status}${code ? ` (${code})` : ''}: ${msg}`);
    appendFile(logFile, `${new Date().toISOString()} OpenAI ${endpoint} ${response.status} ${code || ''} ${data.error?.type || ''}: ${msg}\n`).catch(() => {});
    if (code === 'insufficient_quota' || code === 'credit_balance_exhausted' || data.error?.type === 'insufficient_quota') fail('Your OpenAI account has no API credits remaining. Add credits at platform.openai.com/settings/organization/billing, then try again. Your draft is still here.', 402);
    if (response.status === 401) fail('The API key was rejected. Check the project’s key setup.', 401);
    // Rate limits and hiccups: wait and retry a few times before giving up.
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const wait = Math.min(20, Number(response.headers.get('retry-after')) || 2 ** (attempt + 1));
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (response.status === 429) fail(`OpenAI is limiting requests right now. Wait a minute and try again. (${msg.slice(0, 200)})`, 429);
    fail(`OpenAI could not complete this request (${response.status}): ${msg.slice(0, 300) || 'no details'}`, 502);
  }
}
function chunks(text) {
  const result = [];
  while (text.length > 2600) {
    let cut = text.lastIndexOf('\n', 2600);
    if (cut < 1300) cut = text.lastIndexOf('. ', 2600) + 1;
    if (cut < 1300) cut = text.lastIndexOf(' ', 2600);
    if (cut < 1) cut = 2600;
    result.push(text.slice(0, cut)); text = text.slice(cut).trimStart();
  }
  if (text) result.push(text);
  return result;
}
function sameOrigin(req) {
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
const localForge = createForge({ root, port, api, json, fail, chunks, hasKey: () => Boolean(key) });
// Hosted: one engine per player, each with its own save folder, locks and limits.
const forges = new Map();
function forgeFor(user) {
  if (!forges.has(user.id)) {
    forges.set(user.id, createForge({ root, savesDir: path.join(dataDir, 'users', user.id, 'saves'), port, api, json, fail, chunks, hasKey: () => Boolean(key), usage: auth.usage(user.id), sameOrigin }));
  }
  return forges.get(user.id);
}
async function readJson(req, max = 20000) {
  let b = ''; for await (const chunk of req) { b += chunk; if (b.length > max) fail('That request is too large.', 413); }
  try { return JSON.parse(b || '{}'); } catch { fail('Invalid request.'); }
}
const adminFiles = { '/admin': ['admin.html', 'text/html'], '/admin.js': ['admin.js', 'text/javascript'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  try {
    if (!hosted && req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return json(res,403,{error:'Local access only.'});
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/status') return json(res,200,{configured:Boolean(key), hosted});

    // ----- accounts, feedback and admin (hosted beta) -----
    const user = hosted ? auth.userFor(req) : null;
    if (p.startsWith('/api/auth/') || p === '/api/feedback' || p === '/api/rate' || p.startsWith('/api/ideas') || p.startsWith('/api/admin/')) {
      if (req.method === 'GET' && p === '/api/auth/me') {
        if (!hosted) return json(res, 200, { hosted: false });
        return user ? json(res, 200, { hosted: true, user: auth.me(user) }) : json(res, 401, { hosted: true, error: 'Sign in with your invite code.' });
      }
      const me = hosted ? user : { id: 'local', name: 'You', admin: true };
      if (req.method === 'GET' && p === '/api/ideas') {
        if (!me) return json(res, 401, { error: 'Sign in first.' });
        return json(res, 200, { ideas: beta.list(me.id), admin: Boolean(me.admin) });
      }
      if (req.method !== 'POST' && !(req.method === 'GET' && p === '/api/admin/overview')) return json(res, 405, { error: 'Method not allowed.' });
      if (req.method === 'POST' && !(hosted ? sameOrigin(req) : ['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin))) return json(res, 403, { error: 'Request must come from this app.' });
      if (p === '/api/auth/join') { const d = await readJson(req); const u = await auth.join(res, d.code, d.name); return json(res, 200, { user: auth.me(u) }); }
      if (p === '/api/auth/logout') { await auth.logout(req, res); return json(res, 200, { ok: true }); }
      if (p === '/api/feedback') {
        if (hosted && !user) return json(res, 401, { error: 'Sign in first.' });
        const d = await readJson(req, 10000);
        const text = String(d.text || '').trim().slice(0, 4000);
        if (!text) fail('Write some feedback first.');
        await appendFile(path.join(dataDir, 'feedback.jsonl'), JSON.stringify({ at: new Date().toISOString(), from: user?.name || 'local', page: String(d.page || '').slice(0, 200), text }) + '\n');
        return json(res, 200, { ok: true });
      }
      if (p === '/api/rate' || p.startsWith('/api/ideas')) {
        if (!me) return json(res, 401, { error: 'Sign in first.' });
        const d = await readJson(req, 10000);
        if (p === '/api/rate') { await beta.rate(me, d); return json(res, 200, { ok: true }); }
        if (p === '/api/ideas') await beta.add(me, d.text);
        else if (p === '/api/ideas/vote') await beta.vote(me, String(d.id || ''));
        else if (p === '/api/ideas/remove') await beta.remove(me, String(d.id || ''));
        else if (p === '/api/ideas/mark' && me.admin) await beta.mark(String(d.id || ''), String(d.status || ''));
        else return json(res, 404, { error: 'Not found.' });
        return json(res, 200, { ideas: beta.list(me.id), admin: Boolean(me.admin) });
      }
      if (!hosted || !user?.admin) return json(res, 403, { error: 'Admins only.' });
      if (p === '/api/admin/overview') {
        let feedback = [];
        try { feedback = (await readFile(path.join(dataDir, 'feedback.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).reverse().slice(0, 300); } catch {}
        const ratings = (await beta.ratings()).reverse();
        return json(res, 200, { ...auth.overview(), feedback, ratings: ratings.slice(0, 300), ratingTotals: { up: ratings.filter(r => r.vote === 'up').length, down: ratings.filter(r => r.vote === 'down').length }, ideas: beta.list(user.id) });
      }
      if (p === '/api/admin/invite') { const d = await readJson(req); return json(res, 200, { code: await auth.createInvite(d.note, d.max) }); }
      return json(res, 404, { error: 'Not found.' });
    }
    if (req.method === 'GET' && adminFiles[p]) {
      const [file, type] = adminFiles[p];
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      return res.end(await readFile(path.join(root, 'public', file)));
    }

    if (hosted) {
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) { res.writeHead(302, { Location: '/forge' }); return res.end(); }
      if (p.startsWith('/api/forge/')) {
        if (!user) return json(res, 401, { error: 'Sign in with your invite code.' });
        if (await forgeFor(user)(req, res, url)) return;
      }
      if (await localForge(req, res, url)) return; // static pages only (no saves are reachable without sign-in)
      if (req.method === 'GET' && p === '/favicon.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(await readFile(path.join(root, 'public', 'favicon.svg'))); }
      return json(res, 404, { error: 'Not found.' });
    }
    if (await localForge(req, res, url)) return;
    if (req.method === 'GET' && files[url.pathname]) {
      const [file, type] = files[url.pathname];
      const content = await readFile(path.join(root,'public',file));
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache'}); return res.end(content);
    }
    if (req.method !== 'POST' || !['/api/story','/api/audio'].includes(url.pathname)) return json(res,404,{error:'Not found.'});
    if (!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin)) return json(res,403,{error:'Request must come from this app.'});
    if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON request required.',415);
    if (!key) fail('No OpenAI API key is configured. Finish the key setup for this project.',503);
    if (busy) fail('Another request is running. Please wait for it to finish.',429);
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 160000) fail('This draft is too large for one request.',413); }
    let data; try { data = JSON.parse(body); } catch { fail('Invalid request.'); }
    busy = true;
    try {
      if (url.pathname === '/api/story') {
        const action = data.action;
        if (!['generate','continue','revise'].includes(action)) fail('Choose a writing action.');
        const idea = str(data.idea ?? '',4000,'a story idea',action === 'generate');
        const draft = str(data.draft ?? '',40000,'a draft',action !== 'generate');
        const genre = ['Fantasy','Mystery','Adventure','Science fiction','Romance','Literary fiction'].includes(data.genre) ? data.genre : 'Fantasy';
        const tone = ['Wonder & warmth','Suspenseful','Funny','Dreamlike','Dramatic'].includes(data.tone) ? data.tone : 'Wonder & warmth';
        const words = [350,700,1200].includes(Number(data.words)) ? Number(data.words) : 700;
        const revision = str(data.revision ?? '',1000,'revision instructions',action === 'revise');
        const task = action === 'generate' ? `Write an original ${genre} story of approximately ${words} words with a ${tone} tone. Idea: ${idea}` : action === 'continue' ? `Continue this story naturally in approximately ${words} new words. Preserve viewpoint, tense, voice and continuity. Return only the NEW continuation, with no repeated text.\n\n${draft}` : `Revise the following story according to the author's instructions. Preserve its essence unless asked otherwise. Return the full revised story.\nInstructions: ${revision}\n\n${draft}`;
        const response = await api('responses',{model:process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',instructions:'You are a thoughtful creative writing partner. Write vivid, specific, emotionally engaging fiction with natural dialogue, designed to sound good read aloud. Return story prose only, no markdown formatting or commentary. For a new story, put a short title on the first line, then a blank line and the story. Do not add a title to continuations.',input:task,max_output_tokens:action==='revise'?12000:5000,store:false});
        const result = await response.json();
        const text = result.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n').trim();
        if (!text || result.status === 'incomplete') fail('The story could not finish. Try a shorter story or revision.',502);
        return json(res,200,{text});
      }
      const text = str(data.text,40000,'story text');
      const voice = ['coral','alloy','ash','sage','nova','onyx'].includes(data.voice) ? data.voice : 'coral';
      const style = {warm:'Read as a warm, expressive audiobook narrator, with clear diction and natural pauses. Convey emotion without exaggeration.',dramatic:'Read as an engaging dramatic audiobook narrator. Use suspense, varied pacing and expressive dialogue while keeping the words clear.',calm:'Read as a gentle, calm audiobook narrator, unhurried and soothing, with soft expression and natural pauses.'}[data.style] || 'Read as a warm, clear audiobook narrator.';
      const parts = [];
      for (const input of chunks(text)) {
        const response = await api('audio/speech',{model:'gpt-4o-mini-tts',input,voice,instructions:style,response_format:'mp3'});
        parts.push(Buffer.from(await response.arrayBuffer()));
      }
      res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store','Content-Disposition':'inline; filename="story.mp3"'});
      return res.end(Buffer.concat(parts));
    } finally { busy = false; }
  } catch (error) {
    if (!error.status) console.error('Error:', error.message);
    appendFile(logFile, `${new Date().toISOString()} ${req.method} ${req.url} -> ${error.status || 500}: ${error.message}\n`).catch(() => {});
    json(res,error.status || 500,{error:error.status ? error.message : 'Something interrupted the request. Your draft is unchanged. Please try again.'});
  }
});
server.listen(port, hosted ? '0.0.0.0' : '127.0.0.1', () => console.log(hosted ? `Story Forge (hosted beta) listening on port ${port}` : `Story Studio is ready at http://127.0.0.1:${port}`));
