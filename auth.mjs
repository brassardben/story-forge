// Beta access for the hosted version: invite codes, player codes, sessions and weekly limits.
// Everything lives in one small JSON file in the data folder.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';

const KINDS = ['chapter', 'narration', 'portrait', 'ideas'];
const hash = t => createHash('sha256').update(t).digest('hex');
const code = (n = 6) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
  return Array.from(randomBytes(n), b => abc[b % abc.length]).join('');
};
// Weeks start on Monday (UTC).
export function weekKey(d = new Date()) {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export async function createAuth({ dataDir, adminCode, limits, secure }) {
  const file = path.join(dataDir, 'users.json');
  let db = { users: {}, sessions: {}, invites: {} };
  try { db = { ...db, ...JSON.parse(await readFile(file, 'utf8')) }; } catch {}
  let chain = Promise.resolve();
  const persist = () => (chain = chain.then(async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(db, null, 1));
    await rename(`${file}.tmp`, file);
  }).catch(e => console.error('Could not save users:', e.message)));

  const tokenFrom = req => /(?:^|;\s*)sf_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
  const cookie = (token, maxAge) => `sf_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

  function userFor(req) {
    const t = tokenFrom(req);
    const id = t && db.sessions[hash(t)];
    return id && db.users[id] ? { id, ...db.users[id] } : null;
  }
  function usageOf(u) {
    const wk = weekKey();
    if (u.usage?.week !== wk) u.usage = { week: wk, ...Object.fromEntries(KINDS.map(k => [k, 0])) };
    return u.usage;
  }
  async function startSession(res, id) {
    const token = randomBytes(32).toString('hex');
    db.sessions[hash(token)] = id;
    await persist();
    res.setHeader('Set-Cookie', cookie(token, 60 * 60 * 24 * 365));
  }

  return {
    userFor,
    // Join with an invite code, the admin code, or your own player code (to sign in on another device).
    async join(res, rawCode, rawName) {
      const c = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
      const name = String(rawName || '').trim().slice(0, 40);
      if (!c) throw Object.assign(new Error('Enter your invite code.'), { status: 400 });
      const existing = Object.entries(db.users).find(([, u]) => u.pcode === c);
      if (existing) { await startSession(res, existing[0]); return { id: existing[0], ...existing[1] }; }
      const isAdmin = adminCode && c === String(adminCode).trim().toUpperCase();
      const inv = db.invites[c];
      if (!isAdmin && (!inv || inv.uses >= inv.max)) throw Object.assign(new Error('That code isn’t valid, or it has been used up.'), { status: 403 });
      if (!name) throw Object.assign(new Error('Add a name so we know who you are.'), { status: 400 });
      if (isAdmin) {
        const admin = Object.entries(db.users).find(([, u]) => u.admin);
        if (admin) { await startSession(res, admin[0]); return { id: admin[0], ...admin[1] }; }
      }
      const id = randomBytes(8).toString('hex');
      db.users[id] = { name, admin: Boolean(isAdmin), pcode: code(8), invite: isAdmin ? 'ADMIN' : c, created: Date.now(), usage: null };
      if (!isAdmin) inv.uses += 1;
      await startSession(res, id);
      return { id, ...db.users[id] };
    },
    async logout(req, res) {
      const t = tokenFrom(req);
      if (t) { delete db.sessions[hash(t)]; await persist(); }
      res.setHeader('Set-Cookie', cookie('0'.repeat(64), 0));
    },
    // Weekly limits keep the OpenAI bill predictable during the beta. Admins are unlimited.
    usage(id) {
      return {
        check(kind) {
          const u = db.users[id];
          if (!u || u.admin) return;
          const used = usageOf(u)[kind] || 0, max = limits[kind];
          if (max != null && used >= max) {
            throw Object.assign(new Error(`You’ve hit this week’s beta limit for ${kind === 'chapter' ? 'chapters' : kind === 'narration' ? 'narration' : kind === 'portrait' ? 'portraits' : 'idea pitches'} (${max}). It resets Monday. Thanks for testing!`), { status: 429 });
          }
        },
        add(kind) {
          const u = db.users[id];
          if (!u) return;
          usageOf(u)[kind] = (usageOf(u)[kind] || 0) + 1;
          u.lastSeen = Date.now();
          persist();
        },
      };
    },
    me(u) {
      const usage = usageOf(db.users[u.id]);
      return { name: u.name, admin: u.admin, pcode: u.pcode, usage, limits: u.admin ? null : limits };
    },
    overview() {
      return {
        users: Object.entries(db.users).map(([id, u]) => ({ id, name: u.name, admin: u.admin, invite: u.invite, created: u.created, lastSeen: u.lastSeen || null, usage: usageOf(u) })),
        invites: Object.entries(db.invites).map(([c, i]) => ({ code: c, ...i })),
        limits,
      };
    },
    async createInvite(note, max) {
      let c;
      do { c = `FORGE-${code(4)}`; } while (db.invites[c]);
      db.invites[c] = { note: String(note || '').slice(0, 80), max: Math.max(1, Math.min(500, Number(max) || 1)), uses: 0, created: Date.now() };
      await persist();
      return c;
    },
  };
}
