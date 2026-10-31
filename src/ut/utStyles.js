// Ultimate Team screens: dark stadium UI, FC-style cards (original design).
export const UT_CSS = `
.ut { position: absolute; inset: 0; z-index: 30; display: none; flex-direction: column; color: #fff;
  font-family: var(--font); background: radial-gradient(120% 90% at 70% 0%, #1b2f5c 0%, #0b1428 45%, #050912 100%);
  padding: calc(var(--sat) + 6px) calc(var(--sar) + 10px) calc(var(--sab) + 6px) calc(var(--sal) + 10px); touch-action: auto; }
.ut.show { display: flex; }
.ut *, .ut button { font-family: inherit; color: inherit; }
.ut button { background: none; border: 0; cursor: pointer; padding: 0; touch-action: manipulation; }
.ut-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior: contain; }
.ut-top { display: flex; align-items: center; gap: 12px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.1); flex-shrink: 0; }
.ut-club { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; max-width: 30%; overflow: hidden; }
.ut-tabs { display: flex; gap: 2px; flex: 1; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; }
.ut-tabs::-webkit-scrollbar { display: none; }
.ut .tab { position: relative; padding: 7px 13px 7px 11px; border-radius: 9px; font-weight: 700; font-size: 16px; letter-spacing: .04em; opacity: .7; white-space: nowrap; text-transform: uppercase; }
.ut .tab.on { opacity: 1; background: rgba(124,245,255,.14); box-shadow: inset 0 -2px 0 #7cf5ff; }
.ut .tab .dot { position: absolute; top: -3px; right: -5px; min-width: 16px; height: 16px; border-radius: 8px; background: #ff4b5c; font-size: 11px; font-style: normal; display: grid; place-items: center; padding: 0 3px; }
.ut-coins { display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 18px; background: rgba(0,0,0,.35); padding: 5px 12px; border-radius: 999px; border: 1px solid rgba(255,225,77,.35); }
.coin { display: inline-block; width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3a6, #f2b81f 55%, #a8740c); box-shadow: inset 0 0 0 2px rgba(0,0,0,.18); vertical-align: -2px; margin-right: 3px; }
.ut-body { flex: 1; min-height: 0; padding-top: 8px; display: flex; flex-direction: column; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.ut-body.t-squad { overflow: hidden; }
.ut-sub { font-size: 13px; font-weight: 700; letter-spacing: .12em; opacity: .65; text-transform: uppercase; margin: 6px 0 4px; }
.ut h1 { margin: 4px 0 10px; font-size: 30px; font-style: italic; }
.ut h2 { margin: 0; font-size: 24px; font-style: italic; }
.ut-btn { padding: 10px 16px; border-radius: 11px; font-weight: 800; font-size: 16px; letter-spacing: .04em; background: rgba(255,255,255,.1) !important; border: 1px solid rgba(255,255,255,.18) !important; text-transform: uppercase; }
.ut-btn.primary { background: linear-gradient(180deg, #ffe14d, #f2b81f) !important; color: #10131a !important; border: 0 !important; }
.ut-btn.small { padding: 6px 12px; font-size: 14px; }
.ut-btn:disabled, .ut button:disabled { opacity: .4; }
.ut .chip { padding: 6px 12px; border-radius: 999px; font-weight: 700; font-size: 14px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18); text-transform: uppercase; }
.ut .chip.on { background: #7cf5ff; color: #05101c; box-shadow: none; }
.ut select { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.2); border-radius: 9px; padding: 6px 8px; font-family: inherit; font-size: 15px; font-weight: 700; }
.ut select option { color: #000; }
.ut-field { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; opacity: .9; }
.ut-field input { font: inherit; font-size: 20px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: #fff; text-transform: none; letter-spacing: 0; }
.ut-field.small select { width: 100%; }
.ut-brand { font-weight: 800; letter-spacing: .14em; font-size: 14px; opacity: .8; }
.ut-brand b { color: #ffe14d; }
.ut-setup { max-width: 560px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; padding: 8px 0 20px; }
.kits { display: flex; flex-wrap: wrap; gap: 8px; }
.kitb { padding: 4px !important; border-radius: 10px; background: rgba(255,255,255,.06) !important; box-shadow: inset 0 0 0 2px transparent; }
.kitb.on { box-shadow: inset 0 0 0 2px #7cf5ff; background: rgba(124,245,255,.12) !important; }
.kits.mini .kitb { padding: 2px !important; }
.ut-toast { position: absolute; left: 50%; bottom: calc(var(--sab) + 18px); transform: translateX(-50%); background: #c9f04a; color: #10200a; font-weight: 800; padding: 8px 18px; border-radius: 999px; z-index: 50; white-space: nowrap; animation: utin .3s; }
@keyframes utin { from { opacity: 0; transform: translate(-50%, 10px); } }
.ut-modal { position: absolute; inset: 0; z-index: 40; background: rgba(2,5,12,.72); display: grid; place-items: center; padding: 10px; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.ut-mbox { max-height: 100%; max-width: min(760px, 96vw); background: linear-gradient(180deg, #14213f, #0b1326); border: 1px solid rgba(255,255,255,.14); border-radius: 16px; padding: 14px 16px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.ut-modal.wide .ut-mbox { max-width: 96vw; width: 96vw; }

/* ---------- cards */
.card { --w: 112px; position: relative; width: var(--w); height: calc(var(--w) * 1.42); flex-shrink: 0;
  clip-path: polygon(50% 0, 100% 6%, 100% 86%, 50% 100%, 0 86%, 0 6%); color: #2a1d06;
  background: linear-gradient(160deg, #f6e08a 0%, #d8b04a 45%, #b28a2a 100%); display: flex; flex-direction: column; align-items: center; font-size: calc(var(--w) * .1); }
.card.silver { background: linear-gradient(160deg, #eef2f6, #b9c2cc 50%, #8a95a3); color: #1c232c; }
.card.bronze { background: linear-gradient(160deg, #e8b07e, #b4733f 50%, #7d4a24); color: #2a1408; }
.card.rare::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, rgba(255,255,255,.0) 0 9px, rgba(255,255,255,.22) 9px 11px); mix-blend-mode: overlay; }
.card.gold.rare { background: linear-gradient(160deg, #fff1a8 0%, #f2c94c 35%, #c99520 70%, #8f6410 100%); }
.card.silver.rare { background: linear-gradient(160deg, #ffffff, #c8d2dc 40%, #8794a6); }
.card.bronze.rare { background: linear-gradient(160deg, #f6c08e, #c27a3e 45%, #7a421a); }
.card .c-top { position: absolute; left: 8%; top: 9%; display: flex; flex-direction: column; align-items: center; line-height: .95; z-index: 2; }
.card .c-ovr { font-size: calc(var(--w) * .25); font-weight: 800; }
.card .c-pos { font-size: calc(var(--w) * .1); font-weight: 800; margin-bottom: 3px; }
.card .c-flag svg, .card .c-crest svg { width: calc(var(--w) * .15); height: auto; display: block; margin-top: 2px; }
.card .c-face { position: absolute; top: 4%; right: 2%; width: 68%; height: 52%; object-fit: cover; object-position: 50% 30%; z-index: 1; }
.card .c-name { position: absolute; top: 56%; width: 100%; text-align: center; font-weight: 800; font-size: calc(var(--w) * .13); letter-spacing: .02em; border-top: 1px solid rgba(0,0,0,.15); padding-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card .c-stats { position: absolute; top: 69%; width: 84%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px 4px; font-size: calc(var(--w) * .075); font-weight: 600; }
.card .c-stats span { display: flex; gap: 3px; justify-content: center; }
.card .c-stats b { font-weight: 800; }
.card.xs { --w: 52px; } .card.xs .c-stats, .card.xs .c-name { display: none; } .card.xs .c-face { height: 70%; top: 14%; }
.card.sm { --w: 86px; }
.card.lg { --w: 190px; }
.card .chem { position: absolute; bottom: 4%; display: flex; gap: 3px; z-index: 3; }
.card .chem i { width: 7px; height: 7px; border-radius: 50%; background: rgba(0,0,0,.25); }
.card .chem.c1 i:nth-child(-n+1), .card .chem.c2 i:nth-child(-n+2), .card .chem.c3 i { background: #1db954; box-shadow: 0 0 0 1px rgba(255,255,255,.5); }
.card .oop { position: absolute; top: 49%; left: 0; right: 0; text-align: center; background: #ff4b5c; color: #fff; font-weight: 800; font-size: calc(var(--w) * .085); z-index: 4; }

/* ---------- home */
.home-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.5fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px; }
.tile { border-radius: 14px; padding: 12px 14px !important; text-align: left; display: flex; flex-direction: column; gap: 3px; position: relative; overflow: hidden;
  background: linear-gradient(150deg, rgba(255,255,255,.1), rgba(255,255,255,.03)) !important; border: 1px solid rgba(255,255,255,.12) !important; }
.tile .t-kick { font-size: 12px; font-weight: 800; letter-spacing: .14em; opacity: .7; }
.tile .t-title { font-size: 22px; font-weight: 800; font-style: italic; line-height: 1.05; }
.tile .t-sub { font-size: 14px; opacity: .75; }
.tile.big { grid-row: span 2; background: linear-gradient(150deg, #2ec27e 0%, #0f6b45 60%, #08402a 100%) !important; }
.tile.big .t-title { font-size: 34px; }
.tile .t-cta { margin-top: auto; align-self: flex-start; display: flex; align-items: center; gap: 6px; background: #ffe14d; color: #10131a; padding: 8px 18px; border-radius: 999px; font-weight: 800; font-size: 18px; }
.tile.squad { flex-direction: row; flex-wrap: wrap; align-items: center; }
.tile.squad .t-kick { width: 100%; }
.tile .t-rate { display: flex; flex-direction: column; align-items: center; margin-right: 10px; }
.tile .t-rate b { font-size: 30px; font-weight: 800; line-height: 1; color: #ffe14d; }
.tile .t-rate span { font-size: 11px; letter-spacing: .1em; opacity: .7; }
.tile .t-cards { display: flex; gap: 4px; }
.tile.store { background: linear-gradient(150deg, #6a3cff, #2b1580) !important; }
.tile.daily { background: linear-gradient(150deg, #ff8a3d, #b0400d) !important; }
.tile.daily.done { opacity: .55; }

/* ---------- play */
.play-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.diffs { display: flex; gap: 5px; flex-wrap: wrap; }
.opps { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
.opp { border-radius: 14px; padding: 10px !important; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; background: linear-gradient(170deg, rgba(255,255,255,.1), rgba(255,255,255,.02)) !important; border: 1px solid rgba(255,255,255,.12) !important; }
.opp:active { transform: scale(.97); }
.opp .o-name { font-weight: 800; font-size: 17px; line-height: 1.05; }
.opp .o-lg { font-size: 12px; opacity: .6; }
.opp .o-rate b { font-size: 26px; color: #ffe14d; }
.opp .o-rw { margin-top: auto; font-size: 13px; font-weight: 700; opacity: .85; }
.play-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-weight: 700; font-size: 14px; opacity: .9; flex-wrap: wrap; }

/* ---------- squad */
.t-squad { flex-direction: row !important; gap: 10px; }
.sq-side { width: 190px; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.sq-stats { display: flex; gap: 12px; }
.sq-stats div { display: flex; flex-direction: column; } .sq-stats b { font-size: 30px; color: #ffe14d; line-height: 1; } .sq-stats span { font-size: 11px; letter-spacing: .1em; opacity: .7; }
.bench { display: flex; flex-direction: column; gap: 3px; }
.bn { text-align: left; font-size: 14px; padding: 4px 6px !important; border-radius: 7px; background: rgba(255,255,255,.06) !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bn b { color: #ffe14d; }
.pitch { flex: 1; position: relative; border-radius: 14px; overflow: hidden;
  background: repeating-linear-gradient(90deg, #1f7a3e 0 10%, #1b6f38 10% 20%); box-shadow: inset 0 0 0 2px rgba(255,255,255,.25); }
.pitch::before { content: ''; position: absolute; left: 25%; right: 25%; top: -1px; height: 16%; border: 2px solid rgba(255,255,255,.3); border-top: 0; }
.pitch::after { content: ''; position: absolute; left: 25%; right: 25%; bottom: -1px; height: 16%; border: 2px solid rgba(255,255,255,.3); border-bottom: 0; }
.slot { position: absolute; transform: translate(-50%, -50%); z-index: 2; }
.slot .card.sm { --w: min(86px, 14vh); }
.slot .empty { width: 58px; height: 80px; border-radius: 10px; border: 2px dashed rgba(255,255,255,.5); display: grid; place-items: center; font-size: 28px; font-weight: 800; }
.slot .empty span { font-size: 12px; }
.pick-h { font-weight: 800; font-size: 20px; margin-bottom: 8px; }
.pick { display: flex; flex-wrap: wrap; gap: 8px; }
.pk { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.pk-chem { font-size: 12px; opacity: .8; }

/* ---------- store / packs */
.packs { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.pack { border-radius: 14px; padding: 8px !important; display: flex; flex-direction: column; align-items: center; gap: 2px; background: rgba(255,255,255,.05) !important; border: 1px solid rgba(255,255,255,.12) !important; text-align: center; }
.pk-art { width: 70px; height: 92px; border-radius: 8px; display: grid; place-items: center; font-weight: 800; font-size: 10px; letter-spacing: .08em; padding: 4px; background: linear-gradient(160deg, #f6e08a, #b28a2a); color: #2a1d06; box-shadow: 0 6px 16px rgba(0,0,0,.4); }
.pack.bronze .pk-art { background: linear-gradient(160deg, #e8b07e, #7d4a24); }
.pack.silver .pk-art { background: linear-gradient(160deg, #eef2f6, #8a95a3); }
.pack.rare .pk-art, .pack.premium .pk-art { background: linear-gradient(160deg, #fff1a8, #c99520 60%, #6b4a08); }
.pack.jumbo .pk-art { background: linear-gradient(160deg, #4cc9ff, #1b4fd6); color: #fff; }
.pack.ultimate .pk-art { background: linear-gradient(160deg, #222, #000); color: #ffe14d; box-shadow: 0 0 0 2px #ffe14d, 0 6px 16px rgba(0,0,0,.4); }
.pk-n { font-weight: 800; font-size: 16px; } .pk-d { font-size: 12px; opacity: .7; } .pk-p { font-weight: 800; font-size: 15px; margin-top: 2px; }
.pack.free { box-shadow: 0 0 0 2px #c9f04a; }
.pack-open { position: absolute; inset: 0; z-index: 45; background: radial-gradient(circle at 50% 45%, #2a3f7a, #050912 70%); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pack-open.walkout { background: radial-gradient(circle at 50% 50%, #3a2a00, #050302 70%); }
.wo-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; animation: wo .6s cubic-bezier(.2,1.4,.4,1); }
@keyframes wo { from { transform: scale(.4); opacity: 0; } }
.wo-pos { font-size: 120px; font-weight: 800; font-style: italic; color: #ffe14d; text-shadow: 0 0 40px rgba(255,200,40,.6); }
.wo-cap { font-size: 26px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.wo-flag svg { width: 150px; height: 100px; filter: drop-shadow(0 0 30px rgba(255,255,255,.3)); }
.reveal .card { box-shadow: 0 0 60px rgba(255,220,90,.6); animation: shine 1.4s ease-in-out infinite alternate; }
@keyframes shine { to { filter: brightness(1.12); } }
.wo-skip { position: absolute; bottom: calc(var(--sab) + 14px); font-size: 14px; opacity: .6; letter-spacing: .1em; text-transform: uppercase; }
.pack-open.list { justify-content: flex-start; padding: calc(var(--sat) + 8px) 12px calc(var(--sab) + 8px); }
.po-head { display: flex; gap: 10px; align-items: baseline; font-size: 22px; font-weight: 800; }
.po-head span { font-size: 14px; opacity: .7; }
.po-grid { flex: 1; min-height: 0; width: 100%; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; padding: 8px 0; }
.po-item { display: flex; flex-direction: column; align-items: center; gap: 2px; animation: wo .4s both; }
.po-item.dupe .card { opacity: .75; }
.dupe-tag { font-size: 11px; font-weight: 800; color: #ffb3b3; }
.po-btns { display: flex; gap: 8px; }

/* ---------- club / market */
.club-bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
.club-n { margin-left: auto; opacity: .7; font-weight: 700; }
.club-grid { flex: 1; min-height: 0; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
.cg { position: relative; display: flex; flex-direction: column; align-items: center; }
.cg .in-tag { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 800; background: #1db954; color: #fff; padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
.cg .price { font-weight: 800; font-size: 14px; }
.none { opacity: .6; padding: 20px; }
.cd { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; }
.cd-info h3 { margin: 0 0 6px; font-size: 26px; }
.cd-row { display: flex; align-items: center; gap: 6px; font-size: 16px; margin: 3px 0; opacity: .9; }
.cd-btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.cd-note { font-size: 13px; opacity: .7; margin-top: 6px; }
.confirm { font-size: 18px; text-align: center; }

/* ---------- objectives / rewards */
.objs { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.obj { display: grid; grid-template-columns: 1.4fr 1fr .9fr auto; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 12px; background: rgba(255,255,255,.06); }
.obj b { display: block; font-size: 17px; } .obj span { font-size: 13px; opacity: .7; }
.obj.done { box-shadow: inset 0 0 0 2px #c9f04a; } .obj.got { opacity: .5; }
.o-bar { position: relative; height: 18px; border-radius: 9px; background: rgba(255,255,255,.1); overflow: hidden; }
.o-bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #2ec27e, #c9f04a); }
.o-bar em { position: relative; font-style: normal; font-size: 12px; font-weight: 800; padding-left: 8px; }
.o-rw { font-size: 14px; font-weight: 700; color: #ffe14d; }
.o-ok { font-size: 13px; opacity: .8; }
.rw { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 300px; }
.rw-k { font-weight: 800; letter-spacing: .12em; color: #7cf5ff; }
.rw-score { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; width: 100%; font-weight: 800; font-size: 16px; text-transform: uppercase; }
.rw-score span:first-child { text-align: right; } .rw-score b { font-size: 40px; color: #ffe14d; font-style: italic; }
.rw-row { font-size: 17px; } .rw-row.gold { color: #c9f04a; font-weight: 800; }

/* ---------- hub (FC-mobile style layout) */
.ut { background: radial-gradient(90% 120% at 35% 10%, #3f5a7a 0%, #1d2b44 40%, #0a1120 100%); padding-bottom: 0; }
.ut-top { border-bottom: 0; gap: 10px; height: 54px; }
.tb-club { display: flex; align-items: center; gap: 8px; text-align: left; min-width: 0; }
.tb-club b { display: block; font-size: 19px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.tb-club .lvl { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; opacity: .95; }
.tb-club .lvl i { font-style: normal; background: #36d86b; color: #062010; font-weight: 800; padding: 0 6px; border-radius: 3px; }
.tb-news { display: flex; flex-direction: column; align-items: center; font-size: 11px; font-weight: 700; margin-left: 6px; }
.tb-back { font-weight: 800; font-size: 16px; padding: 6px 12px !important; border-radius: 999px; background: rgba(0,0,0,.3) !important; margin-left: 8px; }
.tb-title { font-weight: 800; font-style: italic; font-size: 22px; text-transform: uppercase; }
.tb-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.cur { display: flex; align-items: center; gap: 5px; font-size: 18px; }
.cur .plus { font-style: normal; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,.85); color: #1a2333; font-weight: 900; display: grid; place-items: center; font-size: 18px; line-height: 1; }
.gem { display: inline-block; width: 20px; height: 18px; background: linear-gradient(160deg, #ff6b7a, #c4101f); clip-path: polygon(20% 0, 80% 0, 100% 35%, 50% 100%, 0 35%); }
.tbi { position: relative; opacity: .95; }
.tbi .badge { position: absolute; top: -6px; right: -8px; background: #ff3b4e; font-style: normal; font-size: 11px; font-weight: 800; min-width: 17px; height: 17px; border-radius: 9px; display: grid; place-items: center; }
.ut-body.t-home { flex-direction: row !important; gap: 12px; padding: 4px 0 8px; overflow: hidden; }
.hub-left { display: flex; flex-direction: column; gap: 9px; justify-content: center; }
.sq { position: relative; width: 74px; height: 74px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  background: linear-gradient(170deg, #1d4f7a, #0e2742) !important; box-shadow: inset 0 0 0 2px rgba(110,170,255,.55), 0 4px 10px rgba(0,0,0,.35); color: #49f2b0 !important; }
.sq span { font-size: 10px; font-weight: 700; color: #fff; letter-spacing: .03em; }
.sq .gbadge { position: absolute; top: -7px; right: -7px; background: #ff3b4e; color: #fff; font-style: normal; font-weight: 800; font-size: 11px; width: 22px; height: 19px; border-radius: 5px; display: grid; place-items: center; }
.rdot, .ndot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: #ff3b4e; }
.hub-hero { flex: 1.25; position: relative; overflow: hidden; border-radius: 4px; }
.gold-ball { position: absolute; left: 8%; top: -45%; width: 80%; filter: drop-shadow(0 20px 30px rgba(0,0,0,.5)); animation: spinball 40s linear infinite; }
.gold-ball svg, .p-art svg, .pt-ball svg { width: 100%; height: auto; display: block; }
@keyframes spinball { to { transform: rotate(360deg); } }
.hero-star { position: absolute; right: 2%; bottom: 14%; width: 38%; height: 58%; }
.hero-star img { width: 100%; height: 100%; object-fit: contain; object-position: bottom; filter: drop-shadow(0 8px 20px rgba(0,0,0,.6)); }
.hero-txt { position: absolute; left: 6%; top: 44%; max-width: 60%; }
.h-kick { font-size: 15px; font-weight: 800; letter-spacing: .2em; color: #e8c15a; }
.h-title { font-size: 44px; font-weight: 800; line-height: .95; letter-spacing: .01em; background: linear-gradient(180deg, #fff6d6, #d9a53a 70%, #8a5f14); -webkit-background-clip: text; background-clip: text; color: transparent; }
.h-sub { font-size: 15px; opacity: .85; margin-top: 4px; }
.hub-hero.swap .hero-txt { animation: utin .5s; }
.go-now { position: absolute; left: 8%; right: 18%; bottom: 7%; height: 46px; border-radius: 999px; font-weight: 700; font-size: 24px; letter-spacing: .04em; color: #1b1406 !important;
  background: linear-gradient(180deg, #e9cf86, #b48a35 55%, #8c6420) !important; box-shadow: inset 0 2px 0 rgba(255,255,255,.4), 0 6px 18px rgba(0,0,0,.5); }
.dots { position: absolute; bottom: 1%; left: 0; right: 0; display: flex; justify-content: center; gap: 7px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.35); }
.dots i.on { background: #fff; }
.hub-right { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.promo { flex: 1.25; position: relative; border-radius: 6px; overflow: hidden; text-align: left; padding: 10px 14px !important;
  background: linear-gradient(135deg, #2a3446, #0d1320) !important; box-shadow: inset 0 0 0 2px rgba(255,255,255,.75); }
.p-title { font-size: 26px; font-weight: 900; letter-spacing: .01em; }
.p-art { position: absolute; inset: 40px 10px 16px 10px; display: flex; align-items: center; justify-content: space-around; }
.p-art .pk-art.big { width: 92px; height: 120px; font-size: 11px; text-align: center; line-height: 1.3; }
.p-art svg { width: 38%; filter: drop-shadow(0 10px 20px rgba(0,0,0,.6)); }
.promo .dots { bottom: 6px; justify-content: flex-end; padding-right: 12px; }
.duo { flex: 1; display: flex; gap: 10px; }
.club-tile, .play-tile { flex: 1; position: relative; border-radius: 5px; overflow: hidden; text-align: left; padding: 8px 12px !important; box-shadow: inset 0 0 0 2px rgba(255,255,255,.55); }
.club-tile { background: linear-gradient(135deg, #1a4b8f 0%, #127a8a 60%, #0e5d6b 100%) !important; }
.play-tile { background: linear-gradient(135deg, #3fe39a, #11a76a 60%, #0a6b45) !important; }
.club-tile b, .play-tile b { font-size: 28px; font-weight: 900; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,.4); }
.play-tile b { color: #0b1a12; text-shadow: none; }
.ovr-shield { position: absolute; left: 14px; bottom: 12px; width: 62px; height: 66px; background: linear-gradient(180deg, #e8303c, #8f0f19); clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
  display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 0 0 3px #ffd84d; }
.ovr-shield small { font-size: 10px; font-weight: 800; } .ovr-shield em { font-style: normal; font-size: 28px; font-weight: 900; line-height: .9; }
.ct-crest { position: absolute; right: 14px; bottom: 14px; }
.ct-chem { position: absolute; right: 12px; top: 10px; font-size: 12px; font-weight: 800; opacity: .9; }
.pt-ball { position: absolute; right: -14%; bottom: -22%; width: 75%; }
.ut-nav { flex-shrink: 0; display: flex; margin: 0 calc(-1 * (var(--sar) + 10px)) 0 calc(-1 * (var(--sal) + 10px)); padding: 0 calc(var(--sar) + 10px) var(--sab) calc(var(--sal) + 10px);
  background: rgba(10,16,28,.88); border-top: 2px solid #2bd47d; }
.ut-nav button { position: relative; flex: 1; height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 20px; font-weight: 500; letter-spacing: .04em; border-right: 1px solid rgba(255,255,255,.12) !important; }
.ut-nav button:last-child { border-right: 0 !important; }
.ut-nav button.store { color: #36e27a !important; }
.ut-nav button.on { background: rgba(255,255,255,.07) !important; }
.ut-nav .ndot { top: 4px; right: 10px; }
.ut img:not([src]) { visibility: hidden; }
.p-title { position: relative; z-index: 2; text-shadow: 0 2px 6px rgba(0,0,0,.6); }
.club-tile b { position: relative; z-index: 2; }
.t-play .opps { flex: none; min-height: 210px; }
.t-play .opp { min-height: 200px; }
.news { max-width: 520px; } .news h3 { margin: 0 0 8px; font-size: 24px; } .news p { margin: 6px 0; font-size: 15px; opacity: .9; }
@media (max-height: 430px) {
  .ut-top { height: 46px; } .tb-club b { font-size: 16px; } .cur { font-size: 15px; } .tb-right { gap: 10px; }
  .sq { width: 58px; height: 58px; } .sq svg { width: 26px; height: 26px; } .sq span { font-size: 8px; }
  .hub-left { gap: 6px; }
  .h-title { font-size: 32px; } .h-kick { font-size: 12px; } .h-sub { font-size: 12px; }
  .go-now { height: 38px; font-size: 19px; }
  .p-title { font-size: 19px; } .p-art { inset: 32px 8px 12px; } .p-art .pk-art.big { width: 56px; height: 74px; font-size: 8px; }
  .club-tile b, .play-tile b { font-size: 21px; } .ovr-shield { width: 38px; height: 42px; left: auto; right: 58px; bottom: 8px; } .ovr-shield em { font-size: 17px; } .ovr-shield small { font-size: 8px; }
  .ct-crest { right: 10px; bottom: 10px; } .ct-chem { display: none; }
  .ct-crest svg { width: 34px; height: 34px; }
  .ut-nav button { height: 40px; font-size: 15px; } .ut-nav svg { width: 20px; height: 20px; }
}
@media (max-height: 430px) {
  .ut .tab { padding: 5px 8px; font-size: 14px; }
  .ut-club span { display: none; }
  .tile .t-title { font-size: 19px; } .tile.big .t-title { font-size: 28px; }
  .card.lg { --w: 150px; }
  .wo-pos { font-size: 90px; }
}
@media (orientation: portrait) {
  .home-grid { grid-template-columns: 1fr 1fr; grid-template-rows: auto; overflow-y: auto; }
  .tile.big { grid-column: span 2; grid-row: auto; min-height: 150px; }
  .opps { grid-template-columns: 1fr 1fr; }
  .t-squad { flex-direction: column !important; }
  .sq-side { width: 100%; flex-direction: row; flex-wrap: wrap; max-height: 30%; }
  .pitch { min-height: 60vh; }
  .obj { grid-template-columns: 1fr 1fr; }
}
`;
