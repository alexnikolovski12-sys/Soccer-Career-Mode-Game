g.autoplay = true;
quickMatch('pro', 120);
const before = { coins: g.ut.s.coins, pts: g.ut.s.sb.points };
g.match.homeGoals = 3; g.match.goals.push({ team: 'home', name: 'X', minute: 10 }, { team: 'home', name: 'X', minute: 20 }, { team: 'home', name: 'X', minute: 30 });
g.match.half = 2; g.match.clock = 48 * 60;
runUntil(() => g.sm.is('FULLTIME'), 10);
const ft = g.sm.is('FULLTIME');
g.continueMatch();
run(0.5);
const modal = document.querySelector('.ut-modal .rw');
return { ft, menu: g.sm.is('MENU'), utShown: g.ut.el.classList.contains('show'), modal: modal ? modal.textContent.replace(/\s+/g, ' ').slice(0, 200) : null,
  coins: g.ut.s.coins - before.coins, pts: g.ut.s.sb.points - before.pts, wins: g.ut.s.prog.wins, claimable: g.ut._claimable() };
