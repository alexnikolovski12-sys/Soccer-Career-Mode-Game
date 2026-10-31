// Friends + notifications. Runs against a simulated set of online managers
// (there's no server in the single-file build), behind the same calls a real
// backend would answer: search, request, respond, and an inbox of notifications.
import { makeRng } from '../core/MathUtil.js';
import { world } from './world.js';

const A = ['Silent', 'Golden', 'Rapid', 'Night', 'Lucky', 'Iron', 'Clutch', 'Prime', 'Ghost', 'Royal', 'Turbo', 'Cosmic', 'Wild', 'Ice', 'Neon', 'Shadow', 'Elite', 'Brave', 'Frosty', 'Mr'];
const B = ['Striker', 'Keeper', 'Nutmeg', 'Volley', 'Maestro', 'Panenka', 'Winger', 'Boss', 'Chip', 'Header', 'Rabona', 'Tiki', 'Taka', 'Finisher', 'Captain', 'Legend', 'Nonchalant', 'Playmaker', 'Sweeper', 'Rocket'];

let DIR = null;
/** The online directory (same names on every device). */
export function directory() {
  if (DIR) return DIR;
  const rng = makeRng(424242);
  const clubs = Object.values(world().clubs).filter((c) => c.level === 1);
  const seen = new Set();
  DIR = [];
  for (let i = 0; i < 260; i++) {
    let name;
    do { name = `${rng.pick(A)}${rng.pick(B)}${rng.chance(0.6) ? rng.int(1, 99) : ''}`; } while (seen.has(name));
    seen.add(name);
    const c = rng.pick(clubs);
    DIR.push({ id: `u${i}`, name, club: c.id, rating: rng.int(62, 89), div: rng.int(1, 10), level: rng.int(3, 60), online: rng.chance(0.4) });
  }
  return DIR;
}
export const userById = (id) => directory().find((u) => u.id === id);

export class Social {
  constructor(ut) { this.ut = ut; }
  get s() {
    const st = this.ut.s;
    if (!st.social) st.social = { friends: [], outgoing: [], incoming: [], notes: [], nextIn: Date.now() + 90e3 };
    return st.social;
  }

  search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    return directory().filter((u) => u.name.toLowerCase().includes(q)).slice(0, 20);
  }

  status(id) {
    const s = this.s;
    if (s.friends.includes(id)) return 'friend';
    if (s.outgoing.some((o) => o.id === id)) return 'sent';
    if (s.incoming.some((o) => o.id === id)) return 'incoming';
    return 'none';
  }

  /** Send a friend request; they answer a little later (see tick). */
  request(id) {
    if (this.status(id) !== 'none') return false;
    const u = userById(id);
    this.s.outgoing.push({ id, at: Date.now(), answerAt: Date.now() + (u.online ? 8e3 : 25e3) + Math.random() * 30e3 });
    this.ut.save();
    return true;
  }

  /** Accept / decline someone's request (they get told). */
  respond(id, accept) {
    const s = this.s;
    s.incoming = s.incoming.filter((r) => r.id !== id);
    for (const n of s.notes) if (n.type === 'request' && n.from === id) { n.done = true; n.answer = accept ? 'accepted' : 'declined'; }
    if (accept && !s.friends.includes(id)) s.friends.push(id);
    this.ut.save();
  }

  unfriend(id) { this.s.friends = this.s.friends.filter((f) => f !== id); this.ut.save(); }

  note(n) { this.s.notes.unshift({ id: Date.now() + Math.random(), at: Date.now(), read: false, ...n }); this.s.notes.length = Math.min(this.s.notes.length, 40); }
  unread() { return this.s.notes.filter((n) => !n.read).length; }
  markRead() { for (const n of this.s.notes) n.read = true; this.ut.save(); }

  /** The "server": answers to your requests, and now and then someone adds you. */
  tick() {
    if (!this.ut.s) return false;
    const s = this.s, now = Date.now();
    let changed = false;
    for (const o of s.outgoing.slice()) {
      if (now < o.answerAt) continue;
      s.outgoing = s.outgoing.filter((x) => x !== o);
      const yes = Math.random() < 0.78;
      if (yes && !s.friends.includes(o.id)) s.friends.push(o.id);
      this.note({ type: 'answer', from: o.id, answer: yes ? 'accepted' : 'declined' });
      changed = true;
    }
    if (now > s.nextIn) {
      s.nextIn = now + 120e3 + Math.random() * 240e3;
      const pool = directory().filter((u) => this.status(u.id) === 'none');
      if (pool.length && s.incoming.length < 4) {
        const u = pool[Math.floor(Math.random() * pool.length)];
        s.incoming.push({ id: u.id, at: now });
        this.note({ type: 'request', from: u.id });
        changed = true;
      }
    }
    if (changed) this.ut.save();
    return changed;
  }
}
