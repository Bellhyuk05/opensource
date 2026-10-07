#!/usr/bin/env node
/* 스테이지 검증기: 모든 스테이지가 실제로 깰 수 있는지 게임과 같은 엔진으로 탐색합니다.
 *   node tools/solve.js          전체 스테이지 검사
 *   node tools/solve.js 7        7스테이지만 검사
 * 입력을 바꿀 수 있는 간격(0.3초 → 0.2초 → 0.1초)을 줄여 가며 풀어 보고,
 * 더 촘촘한 조작이 필요할수록 어려운 스테이지로 봅니다.
 */
const path = require("path");
const E = require(path.join(__dirname, "..", "engine.js"));
const LEVELS = require(path.join(__dirname, "..", "levels.js"));

function solve(def, every, maxSec = 90, maxStates = 3e6) {
  const L = E.parse(def);
  const start = E.init(L);
  const key = s => [Math.round(s.x / 3), Math.round(s.y / 3), Math.round(s.vx / 30), Math.round(s.vy / 40), s.dash, s.stars, s.broken].join(",");
  const seen = new Set([key(start)]);
  let frontier = [{ s: start, path: "" }];
  const maxDepth = Math.ceil(maxSec * 120 / every);
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next = [];
    for (const node of frontier) {
      for (const inp of [1, 0, -1]) {
        const s = E.clone(node.s);
        let res = null;
        for (let k = 0; k < every && !res; k++) res = E.step(L, s, inp);
        const p = node.path + (inp === 1 ? "R" : inp === -1 ? "L" : "-");
        if (res === "clear") return { ok: true, time: ((d + 1) * every) / 120, path: p, states: seen.size };
        if (res === "dead") continue;
        const k = key(s);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s, path: p });
      }
    }
    if (seen.size > maxStates) return { ok: false, reason: "탐색 한도 초과", states: seen.size };
    frontier = next;
  }
  return { ok: false, reason: "해답 없음", states: seen.size };
}

const only = process.argv[2] ? [+process.argv[2] - 1] : LEVELS.map((_, i) => i);
let allOk = true;
for (const i of only) {
  const def = LEVELS[i];
  const tries = [36, 24, 12];  // 0.3초, 0.2초, 0.1초 간격
  let found = null, needed = null;
  for (const every of tries) {
    const r = solve(def, every);
    if (r.ok) { found = r; needed = every; break; }
  }
  if (found) {
    console.log(`${String(i + 1).padStart(2)}. ${def.name.padEnd(8)}  OK  최단 ${found.time.toFixed(1)}초  조작간격 ${(needed / 120).toFixed(1)}초  (상태 ${found.states})`);
    if (process.env.SHOW_PATH) console.log("    " + found.path);
  } else {
    allOk = false;
    console.log(`${String(i + 1).padStart(2)}. ${def.name.padEnd(8)}  ✗  깰 수 없음`);
  }
}
process.exit(allOk ? 0 : 1);
