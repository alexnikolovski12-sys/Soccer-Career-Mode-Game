// Runs the headless playtests (needs `node server.mjs` running on :8080).
//   node tools/run-tests.mjs [file://…/Breakaway.html]
import { execFileSync } from 'node:child_process';
const url = process.argv[2] || 'http://localhost:8080/';
for (const t of ['match', 'restarts', 'usercontrol', 'passing', 'closecontrol', 'lobskill', 'jitter', 'rewards', 'weather', 'foulreplay', 'perf']) {
  console.log(`\n== ${t}`);
  console.log(execFileSync('node', [new URL('./playtest.mjs', import.meta.url).pathname, new URL(`./tests/${t}.js`, import.meta.url).pathname, url], { encoding: 'utf8' }).trim());
}
