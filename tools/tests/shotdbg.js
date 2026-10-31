g.autoplay = true;
quickMatch('semipro', 240);
g.debugDecisions = [];
run(40, () => { if (g.sm.is('GOAL') && g.sm.time > 1.5) g._endReplay(); });
const d = g.debugDecisions;
return { n: d.length, inRange: d.filter((x) => x.can).slice(0, 12), sample: d.filter((x) => x.fx > 0.4).slice(0, 12) };
