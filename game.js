/* 통통볼 챌린지 — 화면, 입력, 진행 저장 */
(() => {
  "use strict";
  const { T, COLS, ROWS, P } = Engine;
  const W = COLS * T, H = ROWS * T;
  const SAVE_KEY = "tongtong-progress-v1";
  const $ = id => document.getElementById(id);

  // ---------------- 진행 저장 ----------------
  let prog = { unlocked: 1, best: {}, sound: true };
  try { Object.assign(prog, JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")); } catch (e) {}
  const saveProg = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(prog)); } catch (e) {} };

  // ---------------- 소리 ----------------
  let actx = null;
  function beep(type) {
    if (!prog.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const now = actx.currentTime;
      const tone = (f0, f1, dur, wave = "sine", vol = 0.12, delay = 0) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(f0, now + delay);
        o.frequency.exponentialRampToValueAtTime(f1, now + delay + dur);
        g.gain.setValueAtTime(vol, now + delay);
        g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        o.connect(g).connect(actx.destination);
        o.start(now + delay); o.stop(now + delay + dur + 0.02);
      };
      if (type === "bounce") tone(320, 520, 0.08, "sine", 0.06);
      else if (type === "jump") tone(300, 1200, 0.22, "triangle", 0.1);
      else if (type === "dash") tone(900, 300, 0.18, "sawtooth", 0.05);
      else if (type === "break") tone(220, 60, 0.15, "square", 0.06);
      else if (type === "star") { tone(880, 880, 0.08, "triangle", 0.1); tone(1320, 1320, 0.12, "triangle", 0.1, 0.07); }
      else if (type === "die") tone(500, 70, 0.4, "sawtooth", 0.08);
      else if (type === "clear") [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, "triangle", 0.1, i * 0.1));
    } catch (e) {}
  }

  // ---------------- 메뉴 ----------------
  function buildMenu() {
    const grid = $("stageGrid");
    grid.innerHTML = "";
    LEVELS.forEach((lv, i) => {
      const n = i + 1;
      const b = document.createElement("button");
      b.className = "stage" + (prog.best[n] != null ? " cleared" : "");
      b.disabled = n > prog.unlocked;
      const bars = Array.from({ length: 10 }, (_, k) => `<i class="${k < n ? "on" : ""}"></i>`).join("");
      b.innerHTML = `<span class="num">${n}</span><span class="nm">${lv.name}</span>
        <span class="diff" title="난이도 ${n}/10">${bars}</span>
        <span class="best">${prog.best[n] != null ? `🏆 ${prog.best[n].toFixed(1)}초` : ""}</span>`;
      b.addEventListener("click", () => startStage(i));
      grid.appendChild(b);
    });
    const cleared = Object.keys(prog.best).length;
    $("progressText").textContent = `클리어 ${cleared} / ${LEVELS.length}`;
    $("soundBtn").textContent = prog.sound ? "🔊 소리 켜짐" : "🔈 소리 꺼짐";
  }

  function show(screen) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === screen));
    if (screen === "play") resize();
  }

  // ---------------- 게임 상태 ----------------
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  let G = null;          // 현재 판
  let input = { l: false, r: false };
  let parts = [];

  function startStage(i) {
    const L = Engine.parse(LEVELS[i]);
    G = { i, L, s: Engine.init(L), time: 0, deaths: 0, dead: 0, clear: false, squash: 0, t: 0, trail: [] };
    parts = [];
    $("hudStage").textContent = i + 1;
    $("hudName").textContent = LEVELS[i].name;
    const tip = $("tip");
    tip.textContent = LEVELS[i].tip;
    tip.classList.remove("fade");
    clearTimeout(startStage.tipTimer);
    startStage.tipTimer = setTimeout(() => tip.classList.add("fade"), 4500);
    hideModal();
    show("play");
    updateHud();
  }

  function respawn() {
    G.s = Engine.init(G.L);
    G.dead = 0;
    G.trail = [];
  }

  function updateHud() {
    if (!G) return;
    const got = popcount(G.s.stars);
    $("hudStars").textContent = `${got}/${G.L.stars.length}`;
    $("hudTime").textContent = G.time.toFixed(1);
    $("hudDeaths").textContent = G.deaths;
  }
  const popcount = n => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };

  function onClear() {
    G.clear = true;
    beep("clear");
    const n = G.i + 1;
    const prev = prog.best[n];
    const isBest = prev == null || G.time < prev;
    if (isBest) prog.best[n] = +G.time.toFixed(2);
    if (n + 1 > prog.unlocked && n < LEVELS.length) prog.unlocked = n + 1;
    saveProg();
    burst(G.s.x, G.s.y, 40, ["#ffcc33", "#ff8a3d", "#4fd1a5", "#ffffff"]);
    const last = n === LEVELS.length;
    setTimeout(() => {
      showModal(last ? "🏆 모두 클리어!" : "클리어!",
        `${last ? "최고 난이도까지 정복했습니다!<br>" : ""}기록 <b>${G.time.toFixed(1)}초</b> · 실패 <b>${G.deaths}회</b>${isBest && prev != null ? "<br>🎉 최고 기록 갱신!" : prev != null ? `<br>최고 기록 ${prev.toFixed(1)}초` : ""}`,
        [
          { label: "메뉴", fn: () => { buildMenu(); show("menu"); } },
          { label: "다시", fn: () => startStage(G.i) },
          ...(last ? [] : [{ label: "다음 ▶", primary: true, fn: () => startStage(G.i + 1) }]),
        ]);
    }, 600);
  }

  // ---------------- 메인 루프 ----------------
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G && $("play").classList.contains("active")) {
      G.t += dt;
      if (!G.clear) {
        if (G.dead > 0) {
          G.dead -= dt;
          if (G.dead <= 0) respawn();
        } else {
          G.time += dt;
          acc += dt;
          const dir = (input.r ? 1 : 0) - (input.l ? 1 : 0);
          while (acc >= P.dt) {
            acc -= P.dt;
            const ev = [];
            const res = Engine.step(G.L, G.s, dir, ev);
            ev.forEach(handleEvent);
            if (res === "dead") {
              G.deaths++; G.dead = 0.7;
              beep("die");
              burst(G.s.x, Math.min(G.s.y, H - 4), 26, ["#ff8a3d", "#ffcc33", "#ff5d5d"]);
              break;
            }
            if (res === "clear") { onClear(); break; }
          }
          G.trail.push({ x: G.s.x, y: G.s.y });
          if (G.trail.length > (G.s.dash ? 10 : 5)) G.trail.shift();
        }
      }
      G.squash = Math.max(0, G.squash - dt * 6);
      updateParts(dt);
      draw();
      updateHud();
    }
    requestAnimationFrame(frame);
  }

  function handleEvent(e) {
    const cx = e.c * T + T / 2, cy = e.r * T;
    if (e.type === "bounce") { G.squash = 1; beep("bounce"); dust(G.s.x, G.s.y + 7, "#c3d0ff"); }
    else if (e.type === "jump") { G.squash = 1; beep("jump"); burst(cx, cy, 10, ["#4fd1a5", "#b6ffe6"]); }
    else if (e.type === "dash") { beep("dash"); burst(cx, cy, 8, ["#ff8a3d", "#ffd2a8"]); }
    else if (e.type === "break") {
      G.squash = 1; beep("break");
      for (let k = 0; k < 8; k++) parts.push({ x: cx + (Math.random() - 0.5) * 24, y: cy + 10 + Math.random() * 14, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 120, life: 0.9, color: k % 2 ? "#c79a6b" : "#8a6440", size: 5 + Math.random() * 4, g: 900, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
    }
    else if (e.type === "star") { beep("star"); burst(e.x, e.y, 16, ["#ffcc33", "#fff3b0"]); }
  }

  function burst(x, y, n, colors) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 200;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.5,
        color: colors[k % colors.length], size: 2 + Math.random() * 3, g: 400, rot: 0, vr: 0 });
    }
  }
  function dust(x, y, color) {
    for (let k = 0; k < 3; k++) parts.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 30, life: 0.3, color, size: 2, g: 0, rot: 0, vr: 0 });
  }
  function updateParts(dt) {
    parts = parts.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt;
      return p.life > 0;
    });
  }

  // ---------------- 그리기 ----------------
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  const bgStars = Array.from({ length: 50 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 53.7) % (H * 0.7), r: 0.6 + (i % 3) * 0.5, ph: i }));

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawTile(ch, c, r) {
    const x = c * T, y = r * T;
    if (ch === "#") {
      ctx.fillStyle = "#5b70b8"; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
      ctx.fillStyle = "#8fa6e8"; rr(x + 1, y + 1, T - 2, T - 6, 6); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)"; rr(x + 5, y + 4, T - 10, 4, 2); ctx.fill();
    } else if (ch === "B") {
      ctx.fillStyle = "#8a6440"; rr(x + 1, y + 1, T - 2, T - 2, 5); ctx.fill();
      ctx.fillStyle = "#c79a6b"; rr(x + 1, y + 1, T - 2, T - 6, 5); ctx.fill();
      ctx.strokeStyle = "#6b4a2c"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + 8, y + 6); ctx.lineTo(x + 14, y + 14); ctx.lineTo(x + 11, y + 20);
      ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + 22, y + 12); ctx.lineTo(x + 25, y + 22); ctx.stroke();
    } else if (ch === "J") {
      ctx.fillStyle = "#2a9d78"; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
      ctx.fillStyle = "#4fd1a5"; rr(x + 1, y + 1, T - 2, T - 6, 6); ctx.fill();
      const bob = Math.sin(G.t * 6) * 1.5;
      ctx.strokeStyle = "#e8fff6"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let k = 0; k < 2; k++) {
        const yy = y + 15 - k * 7 + bob;
        ctx.beginPath(); ctx.moveTo(x + 9, yy + 4); ctx.lineTo(x + 16, yy - 3); ctx.lineTo(x + 23, yy + 4); ctx.stroke();
      }
    } else if (ch === "R" || ch === "L") {
      ctx.fillStyle = "#c95f1e"; rr(x + 1, y + 1, T - 2, T - 2, 6); ctx.fill();
      ctx.fillStyle = "#ff8a3d"; rr(x + 1, y + 1, T - 2, T - 6, 6); ctx.fill();
      const d = ch === "R" ? 1 : -1, slide = ((G.t * 2) % 1) * 3 * d;
      ctx.fillStyle = "#fff0e0";
      ctx.save(); ctx.translate(x + T / 2 + slide, y + 13); ctx.scale(d, 1);
      ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(1, -5); ctx.lineTo(1, -10); ctx.lineTo(10, 0); ctx.lineTo(1, 10); ctx.lineTo(1, 5); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (ch === "^" || ch === "v") {
      ctx.fillStyle = "#e6e9f5"; ctx.strokeStyle = "#8f97b8"; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const bx = x + 4 + k * 8;
        ctx.beginPath();
        if (ch === "^") { ctx.moveTo(bx, y + T); ctx.lineTo(bx + 4, y + T * 0.42); ctx.lineTo(bx + 8, y + T); }
        else { ctx.moveTo(bx, y); ctx.lineTo(bx + 4, y + T * 0.58); ctx.lineTo(bx + 8, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }

  function drawStar(x, y, rad, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr2 = k % 2 ? rad * 0.45 : rad;
      ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fillStyle = "#ffcc33"; ctx.fill();
    ctx.strokeStyle = "#e08a00"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const { L, s, t } = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 배경: 스테이지마다 조금씩 다른 하늘
    const hue = [222, 212, 200, 188, 250, 268, 290, 320, 345, 5][G.i];
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `hsl(${hue}, 45%, ${22 + G.i}%)`);
    sky.addColorStop(1, `hsl(${hue + 30}, 40%, ${36 - G.i}%)`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    bgStars.forEach(b => {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.5 + b.ph);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 먼 언덕
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 70 - Math.sin(x * 0.012 + G.i) * 26 - Math.sin(x * 0.031) * 12);
    ctx.lineTo(W, H); ctx.fill();

    // 지형
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = Engine.tileAt(L, s, c, r);
      if (ch !== ".") drawTile(ch, c, r);
    }

    // 별
    L.stars.forEach((st, i) => {
      if ((s.stars >> i) & 1) return;
      const glow = ctx.createRadialGradient(st.x, st.y, 2, st.x, st.y, 20);
      glow.addColorStop(0, "rgba(255,220,80,.45)"); glow.addColorStop(1, "rgba(255,220,80,0)");
      ctx.fillStyle = glow; ctx.fillRect(st.x - 20, st.y - 20, 40, 40);
      drawStar(st.x, st.y + Math.sin(t * 3 + i) * 2, 10, Math.sin(t * 2 + i) * 0.25);
    });

    // 공
    if (G.dead <= 0) {
      G.trail.forEach((p, k) => {
        ctx.globalAlpha = (k / G.trail.length) * (s.dash ? 0.5 : 0.2);
        ctx.fillStyle = s.dash ? "#ff8a3d" : "#ffcc33";
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const sq = G.squash;
      ctx.save();
      ctx.translate(s.x, s.y + sq * 2);
      ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
      g.addColorStop(0, "#fff6c9"); g.addColorStop(0.35, "#ffcc33"); g.addColorStop(1, "#ff8a3d");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#b4561c"; ctx.lineWidth = 1.2; ctx.stroke();
      // 눈
      const look = Math.max(-1.5, Math.min(1.5, s.vx / 80));
      ctx.fillStyle = "#3a1f0a";
      ctx.beginPath(); ctx.arc(-2.6 + look, -1, 1.2, 0, Math.PI * 2); ctx.arc(2.6 + look, -1, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 입자
    parts.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    if (G.dead > 0) {
      ctx.fillStyle = `rgba(255,80,80,${Math.min(0.25, G.dead * 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------- 모달 ----------------
  let modalActions = [];
  function showModal(title, body, actions) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = body;
    const box = $("modalActions");
    box.innerHTML = "";
    modalActions = actions;
    actions.forEach(a => {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.primary) b.className = "primary";
      b.addEventListener("click", () => { hideModal(); a.fn && a.fn(); });
      box.appendChild(b);
    });
    $("modal").classList.remove("hidden");
  }
  function hideModal() { $("modal").classList.add("hidden"); modalActions = []; }
  const modalOpen = () => !$("modal").classList.contains("hidden");

  // ---------------- 입력 ----------------
  const KEYS_L = ["ArrowLeft", "KeyA"], KEYS_R = ["ArrowRight", "KeyD"];
  window.addEventListener("keydown", e => {
    if (KEYS_L.includes(e.code)) { input.l = true; e.preventDefault(); }
    if (KEYS_R.includes(e.code)) { input.r = true; e.preventDefault(); }
    if (modalOpen()) {
      if (e.code === "Enter" || e.code === "Space") {
        const a = modalActions.find(x => x.primary) || modalActions[modalActions.length - 1];
        if (a) { hideModal(); a.fn && a.fn(); }
        e.preventDefault();
      }
      return;
    }
    if (e.code === "KeyR" && G && $("play").classList.contains("active")) startStage(G.i);
    if (e.code === "Escape" && $("play").classList.contains("active")) { buildMenu(); show("menu"); }
  });
  window.addEventListener("keyup", e => {
    if (KEYS_L.includes(e.code)) input.l = false;
    if (KEYS_R.includes(e.code)) input.r = false;
  });
  window.addEventListener("blur", () => { input.l = input.r = false; });

  function bindPad(id, key) {
    const el = $(id);
    const on = e => { e.preventDefault(); input[key] = true; el.classList.add("down"); };
    const off = e => { e.preventDefault(); input[key] = false; el.classList.remove("down"); };
    el.addEventListener("pointerdown", on);
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => el.addEventListener(t, off));
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  bindPad("padL", "l");
  bindPad("padR", "r");

  $("backBtn").addEventListener("click", () => { buildMenu(); show("menu"); });
  $("retryBtn").addEventListener("click", () => G && startStage(G.i));
  $("soundBtn").addEventListener("click", () => { prog.sound = !prog.sound; saveProg(); buildMenu(); });
  $("resetProgress").addEventListener("click", () => {
    showModal("기록 초기화", "모든 클리어 기록과 해금이 사라집니다.", [
      { label: "취소" },
      { label: "초기화", primary: true, fn: () => { prog = { unlocked: 1, best: {}, sound: prog.sound }; saveProg(); buildMenu(); } },
    ]);
  });
  window.addEventListener("resize", () => { if ($("play").classList.contains("active")) resize(); });

  buildMenu();
  resize();
  requestAnimationFrame(t => { last = t; frame(t); });
  window.__tongtong = { get G() { return G; }, startStage, prog };  // 디버그용
})();
