// Beta tester tools: a thumbs up/down on each chapter, and an ideas board people can vote on.
import { readFile, writeFile, rename, appendFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

export async function createBeta({ dataDir }) {
  const ratingsFile = path.join(dataDir, 'ratings.jsonl');
  const ideasFile = path.join(dataDir, 'ideas.json');
  let ideas = [];
  try { ideas = JSON.parse(await readFile(ideasFile, 'utf8')); } catch {}
  let chain = Promise.resolve();
  const persist = () => (chain = chain.then(async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(`${ideasFile}.tmp`, JSON.stringify(ideas, null, 1));
    await rename(`${ideasFile}.tmp`, ideasFile);
  }).catch(e => console.error('Could not save ideas:', e.message)));
  const bad = (m, status = 400) => { throw Object.assign(new Error(m), { status }); };
  const view = (i, uid) => ({ id: i.id, text: i.text, by: i.by, at: i.at, status: i.status, votes: i.voters.length, mine: i.voters.includes(uid), own: i.uid === uid });

  return {
    async rate(user, d) {
      const vote = d.vote === 'up' ? 'up' : d.vote === 'down' ? 'down' : bad('Pick thumbs up or down.');
      const row = {
        at: new Date().toISOString(), uid: user.id, from: user.name, vote,
        run: String(d.run || '').slice(0, 120), chapter: Number(d.chapter) || 0, title: String(d.title || '').slice(0, 160),
        note: String(d.note || '').trim().slice(0, 1500),
      };
      await mkdir(dataDir, { recursive: true });
      await appendFile(ratingsFile, JSON.stringify(row) + '\n');
    },
    async ratings() {
      try { return (await readFile(ratingsFile, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
    },
    list(uid) {
      return ideas.filter(i => i.status !== 'deleted').map(i => view(i, uid))
        .sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.votes - a.votes || b.at - a.at);
    },
    async add(user, raw) {
      const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 280);
      if (text.length < 5) bad('Write a little more about your idea.');
      const today = Date.now() - 24 * 3600e3;
      if (!user.admin && ideas.filter(i => i.uid === user.id && i.at > today).length >= 5) bad('That’s 5 ideas today. Thanks! Come back tomorrow for more.', 429);
      if (ideas.length >= 2000) bad('The ideas board is full for now.', 429);
      ideas.push({ id: randomBytes(5).toString('hex'), text, by: user.name, uid: user.id, at: Date.now(), status: 'open', voters: [user.id] });
      await persist();
    },
    async vote(user, id) {
      const i = ideas.find(x => x.id === id && x.status !== 'deleted') || bad('That idea is gone.', 404);
      const at = i.voters.indexOf(user.id);
      if (at >= 0) i.voters.splice(at, 1); else i.voters.push(user.id);
      await persist();
    },
    async remove(user, id) {
      const i = ideas.find(x => x.id === id) || bad('That idea is gone.', 404);
      if (!user.admin && i.uid !== user.id) bad('You can only remove your own ideas.', 403);
      i.status = 'deleted';
      await persist();
    },
    async mark(id, status) {
      const i = ideas.find(x => x.id === id) || bad('That idea is gone.', 404);
      if (!['open', 'planned', 'done', 'deleted'].includes(status)) bad('Unknown status.');
      i.status = status;
      await persist();
    },
  };
}
