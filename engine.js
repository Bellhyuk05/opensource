/* 통통볼 챌린지 — 물리 엔진
 * 브라우저(game.js)와 Node(tools/solve.js)가 똑같은 코드를 사용합니다.
 * 그래서 검증기가 "깰 수 있다"고 판단한 스테이지는 실제 게임에서도 깰 수 있습니다.
 */
(function (root) {
  "use strict";

  const T = 32, COLS = 20, ROWS = 13;
  const HB = 7;      // 벽/블록 충돌용 반경
  const HZ = 5;      // 가시 판정용 반경 (조금 너그럽게)
  const EPS = 0.001;

  const P = {
    dt: 1 / 120,
    // 세로 움직임을 10% 느리게: 중력 ×0.81, 튕김 속도 ×0.9 → 튀는 높이는 그대로, 오르내리는 시간만 길어짐
    g: 1215,         // 중력 (원래 1500)
    bounce: 360,     // 일반 블록 튕김 (약 1.7칸 높이, 원래 400)
    jump: 648,       // 점프 블록 (약 5.4칸 높이, 원래 720)
    maxVx: 170,
    accel: 1400,
    decel: 1100,
    dashV: 420,      // 대시 블록 속도
    maxFall: 810,    // 최대 낙하 속도 (원래 900)
  };

  // 지형 기호
  // #  일반 블록       B  부서지는 블록    J  점프 블록
  // R  오른쪽 대시     L  왼쪽 대시        ^  가시(바닥)
  // v  가시(천장)      S  별              P  시작 위치
  const SOLID = { "#": 1, B: 1, J: 1, R: 1, L: 1 };

  function parse(def) {
    const tiles = new Array(COLS * ROWS).fill(".");
    const breakIdx = new Array(COLS * ROWS).fill(-1);
    const stars = [];
    let nBreaks = 0, start = null;
    for (let r = 0; r < ROWS; r++) {
      const row = def.map[r] || "";
      for (let c = 0; c < COLS; c++) {
        let ch = row[c] || ".";
        if (ch === "P") { start = { x: c * T + T / 2, y: r * T + T / 2 }; ch = "."; }
        if (ch === "S") { stars.push({ c, r, x: c * T + T / 2, y: r * T + T / 2 }); ch = "."; }
        if (ch === "B") breakIdx[r * COLS + c] = nBreaks++;
        tiles[r * COLS + c] = ch;
      }
    }
    if (!start) throw new Error(`${def.name}: 시작 위치(P)가 없습니다`);
    if (nBreaks > 30 || stars.length > 30) throw new Error(`${def.name}: B/S 는 30개까지`);
    return { name: def.name, tiles, breakIdx, nBreaks, stars, start, allStars: (1 << stars.length) - 1 };
  }

  function init(L) {
    return { x: L.start.x, y: L.start.y, vx: 0, vy: 0, dash: 0, stars: 0, broken: 0 };
  }

  function clone(s) {
    return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, dash: s.dash, stars: s.stars, broken: s.broken };
  }

  function tileAt(L, s, c, r) {
    if (c < 0 || c >= COLS || r < 0) return "#";  // 화면 좌우·위는 벽
    if (r >= ROWS) return ".";                    // 아래는 낭떠러지
    const i = r * COLS + c;
    const ch = L.tiles[i];
    if (ch === "B" && (s.broken >> L.breakIdx[i]) & 1) return ".";
    return ch;
  }

  // 공의 충돌 상자와 겹치는 단단한 블록 목록
  function solidHits(L, s) {
    const x0 = s.x - HB, x1 = s.x + HB, y0 = s.y - HB, y1 = s.y + HB;
    const out = [];
    for (let r = Math.floor(y0 / T); r <= Math.floor((y1 - EPS) / T); r++) {
      for (let c = Math.floor(x0 / T); c <= Math.floor((x1 - EPS) / T); c++) {
        if (SOLID[tileAt(L, s, c, r)]) out.push({ c, r, ch: tileAt(L, s, c, r) });
      }
    }
    return out;
  }

  function touchesSpike(L, s) {
    const x0 = s.x - HZ, x1 = s.x + HZ, y0 = s.y - HZ, y1 = s.y + HZ;
    for (let r = Math.floor(y0 / T); r <= Math.floor(y1 / T); r++) {
      for (let c = Math.floor(x0 / T); c <= Math.floor(x1 / T); c++) {
        const ch = tileAt(L, s, c, r);
        if (ch !== "^" && ch !== "v") continue;
        const sx0 = c * T + 5, sx1 = c * T + T - 5;
        const sy0 = ch === "^" ? r * T + T * 0.4 : r * T;
        const sy1 = ch === "^" ? r * T + T : r * T + T * 0.6;
        if (x1 > sx0 && x0 < sx1 && y1 > sy0 && y0 < sy1) return true;
      }
    }
    return false;
  }

  /**
   * 한 프레임(1/120초) 진행.
   * input: -1(왼쪽) 0 1(오른쪽)
   * ev: 이펙트용 이벤트를 담을 배열 (생략 가능)
   * 반환: "dead" | "clear" | null
   */
  function step(L, s, input, ev) {
    const dt = P.dt;
    if (s.dash) {
      s.vx = s.dash * P.dashV;
      s.vy = 0;
    } else {
      if (input) {
        s.vx += input * P.accel * dt;
        if (s.vx > P.maxVx) s.vx = P.maxVx;
        if (s.vx < -P.maxVx) s.vx = -P.maxVx;
      } else if (s.vx > 0) s.vx = Math.max(0, s.vx - P.decel * dt);
      else if (s.vx < 0) s.vx = Math.min(0, s.vx + P.decel * dt);
      s.vy = Math.min(P.maxFall, s.vy + P.g * dt);
    }

    // 가로 이동
    s.x += s.vx * dt;
    let hits = solidHits(L, s);
    if (hits.length && s.vx !== 0) {
      if (s.vx > 0) s.x = Math.min(...hits.map(h => h.c * T)) - HB - EPS;
      else s.x = Math.max(...hits.map(h => (h.c + 1) * T)) + HB + EPS;
      s.vx = 0;
      if (s.dash) { s.dash = 0; ev && ev.push({ type: "wall" }); }
    }

    // 세로 이동
    if (!s.dash) {
      s.y += s.vy * dt;
      hits = solidHits(L, s);
      if (hits.length) {
        if (s.vy > 0) {
          const top = Math.min(...hits.map(h => h.r * T));
          s.y = top - HB - EPS;
          const row = hits.filter(h => h.r * T === top);
          // 공 중심 바로 아래 블록을 우선
          row.sort((a, b) => Math.abs(a.c * T + T / 2 - s.x) - Math.abs(b.c * T + T / 2 - s.x));
          const h = row[0];
          if (h.ch === "J") { s.vy = -P.jump; ev && ev.push({ type: "jump", c: h.c, r: h.r }); }
          else if (h.ch === "R" || h.ch === "L") {
            s.dash = h.ch === "R" ? 1 : -1;
            s.vy = 0; s.vx = s.dash * P.dashV;
            ev && ev.push({ type: "dash", c: h.c, r: h.r });
          } else {
            s.vy = -P.bounce;
            if (h.ch === "B") {
              s.broken |= 1 << L.breakIdx[h.r * COLS + h.c];
              ev && ev.push({ type: "break", c: h.c, r: h.r });
            } else ev && ev.push({ type: "bounce", c: h.c, r: h.r });
          }
        } else if (s.vy < 0) {
          s.y = Math.max(...hits.map(h => (h.r + 1) * T)) + HB + EPS;
          s.vy = 0;
          ev && ev.push({ type: "bonk" });
        }
      }
    }

    // 별
    for (let i = 0; i < L.stars.length; i++) {
      if ((s.stars >> i) & 1) continue;
      const st = L.stars[i];
      const dx = st.x - s.x, dy = st.y - s.y;
      if (dx * dx + dy * dy < 18 * 18) {
        s.stars |= 1 << i;
        ev && ev.push({ type: "star", i, x: st.x, y: st.y });
      }
    }
    if (s.stars === L.allStars) return "clear";

    if (touchesSpike(L, s)) return "dead";
    if (s.y - HB > ROWS * T + 16) return "dead";
    return null;
  }

  const Engine = { T, COLS, ROWS, P, SOLID, parse, init, clone, step, tileAt };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
