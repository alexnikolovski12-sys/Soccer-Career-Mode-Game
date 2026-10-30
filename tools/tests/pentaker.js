// A teammate is fouled in the box: your career player must take it.
startMoment();
g.moments.current.timer = 60;
const mate = g.teammates[0], d = g.defenders[0];
g.switchControl(mate, true);
const before = g.user === g.career;
g.ball.reset(44, 3); g.ball.owner = mate; mate.place(43.5, 3, Math.PI / 2); d.place(42.8, 3, Math.PI / 2);
g.onFoul({ by: d, victim: mate });
runUntil(() => g.setPiece && g.setPiece.phase === 'ready', 20);
const sp = g.setPiece; return { phase: sp && sp.phase, pen: sp && sp.penalty, user: g.user.id, career: g.career.id, mate: mate.id, inMates: g.teammates.includes(g.career), owner: g.ball.owner && g.ball.owner.id, controlledMateBefore: !before, takerIsYou: g.user === g.career, ballOwnerIsYou: g.ball.owner === g.career };
