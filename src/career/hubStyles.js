// Career hub styles (original design). Injected once by Hub.
export const HUB_CSS = `
.hub { position:absolute; inset:0; z-index:60; display:none; flex-direction:column; color:#fff;
  font-family:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;
  background:
    radial-gradient(120% 90% at 85% 10%, rgba(176,92,255,.35), transparent 60%),
    radial-gradient(90% 80% at 0% 100%, rgba(80,20,140,.55), transparent 60%),
    linear-gradient(135deg,#2a0b4d 0%,#3d1270 45%,#1e0838 100%);
  padding: calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 14px) calc(env(safe-area-inset-bottom) + 6px) calc(env(safe-area-inset-left) + 14px);
  -webkit-user-select:none; user-select:none; }
.hub.show { display:flex; }
.hub::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.18;
  background: repeating-linear-gradient(115deg, transparent 0 120px, rgba(255,255,255,.08) 120px 121px); }
.hub-scroll { overflow-y:auto; -webkit-overflow-scrolling:touch; touch-action:pan-y; }
.hub button { font-family:inherit; color:inherit; cursor:pointer; }

/* top bar */
.hub-top { display:flex; align-items:center; gap:14px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.12); position:relative; }
.hub-logo { width:34px; height:34px; border-radius:50%; border:2px solid #fff; display:grid; place-items:center; font-weight:800; font-style:italic; font-size:18px; flex-shrink:0; }
.hub-logo small { font-size:11px; margin-left:-2px; }
.hub-tabs { display:flex; gap:4px; overflow-x:auto; flex:1; scrollbar-width:none; }
.hub-tabs::-webkit-scrollbar { display:none; }
.tab { background:none; border:0; font-size:17px; font-weight:600; letter-spacing:.02em; color:rgba(255,255,255,.62); padding:6px 10px; position:relative; white-space:nowrap; }
.tab.on { color:#fff; font-weight:800; }
.tab.on::after { content:''; position:absolute; left:10px; right:10px; bottom:0; height:3px; border-radius:2px; background:#c9f04a; }
.tab i { font-style:normal; background:#ff3b5c; border-radius:999px; font-size:11px; padding:0 5px; margin-left:4px; vertical-align:top; }
.hub-club { display:flex; align-items:center; gap:8px; text-align:right; flex-shrink:0; }
.hub-club b { display:block; font-size:15px; }
.hub-club span { font-size:12px; opacity:.75; }

.hub-body { flex:1; min-height:0; display:flex; gap:22px; padding-top:10px; position:relative; }

/* home */
.home-left { flex:1; min-width:0; padding-right:4px; }
.date { font-size:clamp(26px,5.2vw,44px); font-weight:800; letter-spacing:.01em; line-height:1; }
.md { font-size:14px; font-weight:700; margin:6px 0 8px; opacity:.85; }
.fixture { border-top:1px solid rgba(255,255,255,.14); border-bottom:1px solid rgba(255,255,255,.14); padding:8px 0; max-width:480px; }
.fx-league { font-size:14px; font-weight:700; }
.fx-league span { opacity:.6; font-weight:500; margin-left:6px; }
.fx-teams { display:flex; align-items:center; gap:12px; margin-top:6px; }
.fx-crests { display:flex; gap:6px; }
.fx-names { font-size:clamp(17px,3vw,24px); font-weight:800; line-height:1.15; }
.fx-names em { font-style:normal; font-weight:500; opacity:.6; margin-left:4px; font-size:.8em; }
.actions { display:flex; gap:10px; margin:10px 0; flex-wrap:wrap; }
.hub-btn { border:0; border-radius:999px; padding:9px 20px; font-size:17px; font-weight:800; letter-spacing:.03em;
  background:rgba(255,255,255,.12); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.25); }
.hub-btn.primary { background:linear-gradient(180deg,#8a3cf0,#5b1fb8); box-shadow: inset 0 0 0 2px #c58cff, 0 4px 14px rgba(140,60,255,.45); }
.hub-btn.small { padding:6px 16px; font-size:15px; }
.hub-btn:disabled { opacity:.4; }
.hub-btn:active { transform:scale(.96); }
.tasks { display:flex; flex-direction:column; max-width:480px; }
.task { display:flex; align-items:center; gap:10px; background:none; border:0; border-bottom:1px solid rgba(255,255,255,.1); padding:8px 2px; text-align:left; font-size:16px; }
.task .ti { width:26px; text-align:center; }
.task .tt { flex:1; }
.task small { display:block; opacity:.6; font-size:13px; }
.task .tg { opacity:.5; font-size:20px; }
.home-right { width:min(34%,280px); display:flex; align-items:center; justify-content:center; }
.avatar-card { width:100%; border-radius:16px; padding:12px; text-align:center;
  background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.03)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
.av3d { width:100%; height:clamp(150px, 48vh, 300px); position:relative; touch-action:none; }
.avatar3d { display:block; width:100%; height:100%; cursor:grab; }
.avatar3d-fallback { width:100%; height:100%; }
.av-name { font-size:22px; font-weight:800; margin-top:4px; }
.av-meta { font-size:14px; opacity:.85; margin:2px 0 10px; }

/* messages */
.msg-list { width:42%; min-width:180px; display:flex; flex-direction:column; }
.msg { display:flex; gap:10px; align-items:center; background:none; border:0; border-bottom:1px solid rgba(255,255,255,.1); padding:8px 6px; text-align:left; border-radius:8px; }
.msg.on { background:rgba(255,255,255,.1); }
.msg .mi { font-size:20px; }
.msg .mt b { display:block; font-size:16px; }
.msg .mt small { opacity:.6; font-size:13px; }
.msg.unread .mt b::after { content:''; display:inline-block; width:8px; height:8px; border-radius:50%; background:#c9f04a; margin-left:6px; vertical-align:middle; }
.msg-detail { flex:1; min-width:0; padding:4px 6px; }
.md-from { font-size:14px; opacity:.8; }
.md-from span { opacity:.7; }
.msg-detail h2 { font-size:26px; margin:6px 0; }
.msg-detail p { font-size:17px; line-height:1.35; font-family:system-ui,sans-serif; font-size:15px; opacity:.92; }
.md-acts { display:flex; gap:10px; margin-top:10px; }
.md-done { opacity:.75; }
.empty { opacity:.6; }

/* club / country / shop */
.club-left, .club-right, .country, .shop { flex:1; min-width:0; }
.club-card, .nat-head { display:flex; align-items:center; gap:12px; }
.club-card h2, .nat-head h2 { font-size:26px; margin:0; }
.club-card span, .nat-head span { font-size:15px; opacity:.8; }
.club-row, .bank { display:flex; gap:10px; margin:10px 0; }
.club-row div, .bank div, .caps { flex:1; background:rgba(255,255,255,.08); border-radius:12px; padding:6px 10px; }
.club-row b, .bank b, .caps b { display:block; font-size:22px; }
.club-row span, .bank span, .caps span { font-size:12px; opacity:.7; text-transform:uppercase; letter-spacing:.06em; }
h3 { font-size:18px; margin:12px 0 6px; }
h3 small { font-weight:500; opacity:.6; font-size:13px; margin-left:6px; }
.obj { margin-bottom:8px; }
.ob-t { display:flex; justify-content:space-between; font-size:16px; }
.ob-t span { opacity:.75; }
.bar { height:6px; background:rgba(255,255,255,.12); border-radius:4px; overflow:hidden; margin-top:3px; }
.bar i { display:block; height:100%; background:linear-gradient(90deg,#9b5cff,#c9f04a); }
.obj.done .ob-t { color:#c9f04a; }
.tbl { width:100%; border-collapse:collapse; font-size:14px; }
.tbl th { text-align:left; opacity:.6; font-weight:600; padding:3px 4px; }
.tbl td { padding:3px 4px; border-top:1px solid rgba(255,255,255,.07); white-space:nowrap; }
.tbl tr.me td { background:rgba(201,240,74,.18); font-weight:800; }
.bigflag { display:flex; }
.ic { vertical-align:-3px; flex-shrink:0; }
.flag { border-radius:3px; vertical-align:-3px; flex-shrink:0; }
.flag-code { font-size:11px; font-weight:800; padding:1px 4px; border-radius:4px; background:rgba(255,255,255,.18); }
.hub-btn { display:inline-flex; align-items:center; gap:7px; }
.task .ti { display:flex; justify-content:center; color:#d9c2ff; }
.msg .mi { color:#d9c2ff; display:flex; }
.obl { display:flex; align-items:center; gap:7px; }
.obj.done .ic { color:#c9f04a; }
.rev li { display:flex; align-items:center; gap:7px; margin:3px 0; }
.rev li.ok .ic { color:#c9f04a; } .rev li.no .ic { color:#ff8aa0; }
.md-from { display:flex; align-items:center; gap:6px; }
.of-lg, .fx-league, .av-meta { display:flex; align-items:center; gap:6px; }
.av-meta { justify-content:center; }
.nat-head .ok { color:#c9f04a; } .nat-head .no { color:#ffb3c0; }
.nat-head .caps { flex:0 0 auto; text-align:center; }
.shop-item { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.1); }
.shop-item b { display:block; font-size:16px; }
.shop-item small { opacity:.7; font-size:13px; }

/* setup */
.hub-setup { flex:1; max-width:760px; margin:0 auto; width:100%; text-align:center; padding:4px 0 12px; }
.hub-brand { font-size:15px; letter-spacing:.2em; opacity:.8; }
.hub-brand b { color:#c9f04a; }
.hub-setup h1 { font-size:clamp(24px,4.5vw,36px); margin:6px 0; }
.hub-sub { opacity:.75; margin:0 0 10px; font-size:15px; }
.hub-field { display:flex; flex-direction:column; gap:6px; max-width:320px; margin:10px auto; font-size:15px; text-align:left; }
.hub-field input { font-family:inherit; font-size:20px; padding:10px 14px; border-radius:12px; border:0; background:rgba(255,255,255,.14); color:#fff; outline:none; -webkit-user-select:text; user-select:text; }
.offer-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.offer { width:min(220px,30%); min-width:150px; border:0; border-radius:16px; padding:10px; text-align:left;
  background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04)); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.2); }
.offer:active { transform:scale(.97); }
.of-top { display:flex; gap:6px; }
.of-name { font-size:19px; font-weight:800; margin-top:4px; line-height:1.1; }
.of-lg { font-size:14px; opacity:.8; }
.of-meta { display:flex; flex-direction:column; font-size:13px; margin-top:4px; opacity:.9; }
.offer-row.small .offer { min-width:140px; }
.nation-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; }
.nat { display:flex; align-items:center; gap:8px; border:0; border-radius:12px; padding:8px 10px; background:rgba(255,255,255,.1); font-size:15px; font-weight:700; text-align:left; }
.nat .flag { width:30px; height:20px; }

/* pop-ups */
.hub-pop { position:absolute; inset:0; z-index:5; display:grid; place-items:center; background:rgba(10,2,22,.6); padding:12px; }
.pop-card { width:min(560px,94vw); max-height:92%; border-radius:18px; padding:14px 18px;
  background:linear-gradient(160deg,#4a1a86,#2a0c52); box-shadow: 0 20px 60px rgba(0,0,0,.6), inset 0 0 0 1.5px rgba(255,255,255,.18); }
.pop-card h2 { margin:0 0 6px; font-size:26px; }
.pop-body p { font-family:system-ui,sans-serif; font-size:15px; line-height:1.35; }
.pop-btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
.grade { width:56px; height:56px; border-radius:50%; display:grid; place-items:center; font-size:30px; font-weight:800; float:right; margin-left:10px; }
.grade.gA { background:#c9f04a; color:#1b0a33; } .grade.gB { background:#7fb6ff; color:#0b1530; } .grade.gC { background:#ff9aae; color:#330a14; }
.gains { display:flex; gap:12px; list-style:none; padding:0; font-size:17px; flex-wrap:wrap; }
.gains b { color:#c9f04a; }
.ft { display:flex; align-items:center; justify-content:center; gap:16px; }
.ft-score { font-size:44px; font-weight:800; }
.ft-res { text-align:center; font-weight:800; letter-spacing:.2em; }
.ft-res.win { color:#c9f04a; } .ft-res.loss { color:#ff8aa0; }
.ft-line { text-align:center; opacity:.8; margin:2px 0; }
.ft-stats { display:flex; gap:10px; }
.ft-stats div { flex:1; text-align:center; background:rgba(255,255,255,.08); border-radius:12px; padding:6px; }
.ft-stats b { display:block; font-size:24px; }
.ft-stats span { font-size:12px; opacity:.7; text-transform:uppercase; }
.rev { list-style:none; padding:0; font-size:16px; }
.hub-toast { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); background:#c9f04a; color:#1b0a33; font-weight:800; padding:8px 18px; border-radius:999px; z-index:9; }

/* small / portrait */
@media (max-height: 430px) {
  .hub-body { gap:14px; padding-top:6px; }
  .av3d { height:clamp(130px, 44vh, 220px); }
  .tab { font-size:16px; padding:4px 8px; }
  .hub-club span { display:none; }
}
@media (orientation: portrait) {
  .hub-body { flex-direction:column; overflow-y:auto; }
  .home-right { width:100%; }
  .avatar-card { display:flex; align-items:center; gap:10px; text-align:left; }
  .av3d { width:110px; height:150px; flex-shrink:0; }
  .msg-list { width:100%; max-height:40%; }
  .hub-club { display:none; }
}
`;
