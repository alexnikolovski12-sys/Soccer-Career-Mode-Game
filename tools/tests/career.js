// Career: audio muted in the hub, customisation reaches the match model, boots lock, rival sponsors, scorelines.
const out = {};
try { localStorage.clear(); } catch (_) {}
const H = g.hub, C = H.career;
C.create({ name: 'Test Nine', nationality: 'ENG', clubId: C.startingOffers()[0].clubId, wage: 500 });
g.audio.unlock();
H.open(); g.sm.change('HUB');
// customise
H._customise();
const panel = document.querySelector('.custom');
out.bootsLocked = panel.querySelectorAll('.sw.locked').length;
C.customise({ hairStyle: 'afro', sleeves: 'long', facial: 'beard', number: 7, skin: '#6e4026' });
panel.querySelector('.cu-done').click();
// sponsors: two boot brands → second refused; non-rival accepted
const boots = ['Stryde', 'Volt'];
C.message('sponsor', 'a', 'a', [{ label: 'Accept', act: 'sponsor', brand: 'B1', cat: 'boots', weekly: 100, weeks: 10 }]);
C.act(C.s.messages[0].id, 0);
C.message('sponsor', 'b', 'b', [{ label: 'Accept', act: 'sponsor', brand: 'B2', cat: 'boots', weekly: 100, weeks: 10 }]);
C.act(C.s.messages[0].id, 0);
C.message('sponsor', 'c', 'c', [{ label: 'Accept', act: 'sponsor', brand: 'S1', cat: 'soda', weekly: 100, weeks: 10 }]);
C.act(C.s.messages[0].id, 0);
out.sponsors = C.s.sponsors.map((x) => x.brand).join(',');
out.rivalMsg = C.s.messages[1].choice;
out.bootsUnlocked = C.bootsUnlocked();
H._customise(); out.bootsLockedAfter = document.querySelectorAll('.custom .sw.locked').length; document.querySelector('.custom .cu-done').click();
// play a career match
const fx = C.nextFixture();
H._play(fx);
run(0.5);
out.num = g.career._numMesh ? 'has-num' : 'no-num';
out.forearmMat = g.career._forearms && g.career._forearms[0].material === g.career._mats.kit;
const nums = [...g.teammatePool, ...g.extraPool].map((p) => p.look.number);
out.dupOfMine = nums.filter((n) => n === 7).length;
out.fxGainMatch = +g.audio.fx.gain.value.toFixed(2);
// finish
g.finishCareerMatch();
const t0 = performance.now(); while (performance.now() - t0 < 1500) {}
await new Promise((r) => setTimeout(r, 1500));
out.state = g.sm.current && (g.sm.current.name || g.sm.state);
out.fxGainHub = +g.audio.fx.gain.value.toFixed(3);
out.bedHub = g.audio.bed ? +g.audio.bed.gain.gain.value.toFixed(3) : null;
// scorelines: simulate many matches of sim gaps
const TEAMS_r = [];
g.careerMatch = { lastNews: null };
const mt = g.moments.match;
const tally = {};
let ga = 0;
for (let i = 0; i < 400; i++) { mt.homeGoals = 0; mt.awayGoals = 0; for (let k = 0; k < 7; k++) g._simBetweenMoments(); ga += mt.awayGoals; tally[mt.awayGoals] = (tally[mt.awayGoals] || 0) + 1; }
g.careerMatch = null;
out.oppGoalsAvg = ga / 400; out.oppDist = tally;
return out;
