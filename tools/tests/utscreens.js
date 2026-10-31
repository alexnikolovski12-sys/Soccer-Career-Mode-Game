// Screenshots of the Ultimate Team screens (DOM over the canvas → html2canvas-free: we use the page screenshot instead).
const ut = g.ut;
if (!ut.s) { ut._setup(); document.querySelector('.ut-setup .nm').value = 'Harbour City FC'; document.querySelector('.ut-setup .go').click(); const ov = document.querySelector('.pack-open'); if (ov) { ov.click(); document.querySelector('.pack-open .keep').click(); } }
window.__tabs = ['home', 'play', 'squad', 'store', 'club', 'market', 'obj'];
return { coins: ut.s.coins, owned: ut.s.owned.length, rating: ut.rating(), chem: ut.chem().total };
