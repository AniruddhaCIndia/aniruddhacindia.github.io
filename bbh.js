// ============================================================
// Binary Black Hole Merger — instance-mode p5 sketch
// Left panel: inspiral -> merger -> ringdown orbit
// Right panel: corresponding strain waveform, drawn as it plays
//
// Timing note: every phase advances using real elapsed time
// (deltaTime), not frame counts. This keeps the animation's
// duration and the ringdown's decay rate consistent regardless
// of the viewer's device frame rate.
// ============================================================

function bbhSketch(p) {
  const BG_COLOR = [250, 243, 232];
  const INK = [26, 23, 18];
  const GOLD = [176, 141, 87];
  const WAVE_COLOR = [43, 46, 119];
  const DIVIDER_COLOR = [26, 23, 18, 50];

  let state = "idle"; // idle -> inspiral -> merger -> ringdown -> done
  let m1 = 30, m2 = 22, mTotal = 52;
  let inspiralElapsed = 0, mergerElapsed = 0, ringElapsed = 0, globalElapsed = 0;
  let orbitalPhase = 0, ringPhase = 0;
  let inspiralDuration = 5, mergerDuration = 16 / 60, ringdownDuration = 3;
  const fStart = 0.55;
  let ampAtMerger = 1, peakAmp = 1;
  let fRing = 2, tau = 1;
  let lastX1 = 0, lastY1 = 0, lastX2 = 0, lastY2 = 0;
  let waveformPoints = [];
  let rings = [];
  let lastRingSpawnTime = 0;
  let totalDuration = 1;
  let waveScale = 60;

  function computeCanvasSize() {
    const el = document.getElementById("bbh-container");
    const available = el ? el.offsetWidth : 800;
    const w = Math.max(280, Math.min(1200, available));
    return { w, h: w / 2 };
  }

  function panelCenter() {
    return { cx: p.width / 4, cy: p.height / 2 };
  }

  function frequencyAt(s) {
    // Leading-order chirp: f grows as (time-to-merger)^(-3/8)
    return fStart * Math.pow(1 - 0.995 * s, -0.375);
  }

  function randomizeAndPlay() {
    m1 = p.random(8, 55);
    m2 = p.random(8, 55);
    mTotal = m1 + m2;
    const mc = Math.pow(m1 * m2, 0.6) / Math.pow(mTotal, 0.2);
    const mcClamped = p.constrain(mc, 6, 45);
    inspiralDuration = p.map(mcClamped, 6, 45, 7.0, 2.33); // seconds
    mergerDuration = 16 / 60; // seconds (~0.27s, brief visual merger burst)

    fRing = 130 / mTotal;
    const q = 6; // quality factor of the dominant ringdown mode
    tau = Math.min(q / (2 * Math.PI * fRing), 3.0);
    ringdownDuration = Math.min(4 * tau, 260 / 60);

    totalDuration = inspiralDuration + mergerDuration + ringdownDuration;

    inspiralElapsed = 0; mergerElapsed = 0; ringElapsed = 0; globalElapsed = 0;
    orbitalPhase = 0; ringPhase = 0; lastRingSpawnTime = 0;
    waveformPoints = [];
    rings = [];
    ampAtMerger = Math.pow(frequencyAt(1) / fStart, 2 / 3);
    peakAmp = ampAtMerger * 1.15;
    waveScale = (p.height * 0.42) / peakAmp;

    state = "inspiral";
    p.background(...BG_COLOR);
    p.loop();
  }

  function drawDivider() {
    p.stroke(...DIVIDER_COLOR);
    p.strokeWeight(1);
    p.line(p.width / 2, 0, p.width / 2, p.height);
    p.noStroke();
  }

  function drawBlackHole(x, y, r) {
    p.stroke(GOLD[0], GOLD[1], GOLD[2], 180);
    p.strokeWeight(1);
    p.fill(INK[0], INK[1], INK[2]);
    p.circle(x, y, r * 2);
    p.noStroke();
  }

  function plotWaveformSample(t, h) {
    waveformPoints.push({ t, h });
    if (waveformPoints.length < 2) return;
    const a = waveformPoints[waveformPoints.length - 2];
    const b = waveformPoints[waveformPoints.length - 1];
    const x1 = p.map(a.t, 0, totalDuration, p.width / 2, p.width);
    const y1 = p.height / 2 - a.h * waveScale;
    const x2 = p.map(b.t, 0, totalDuration, p.width / 2, p.width);
    const y2 = p.height / 2 - b.h * waveScale;
    p.stroke(WAVE_COLOR[0], WAVE_COLOR[1], WAVE_COLOR[2], 220);
    p.strokeWeight(1.4);
    p.line(x1, y1, x2, y2);
    p.noStroke();
  }

  function drawIdleScene() {
    p.background(...BG_COLOR);
    drawDivider();
    const { cx, cy } = panelCenter();
    drawBlackHole(cx - 55, cy, 10);
    drawBlackHole(cx + 55, cy, 8);
  }

  p.setup = function () {
    const size = computeCanvasSize();
    const canvas = p.createCanvas(size.w, size.h);
    canvas.parent("bbh-container");
    canvas.attribute(
      "aria-label",
      "Binary black hole merger animation with corresponding gravitational wave strain plot"
    );
    p.pixelDensity(1);
    p.noStroke();
    drawIdleScene();

    const btn = document.getElementById("bbh-randomize-btn");
    if (btn) btn.addEventListener("click", randomizeAndPlay);

    p.noLoop();
  };

  p.windowResized = function () {
    const size = computeCanvasSize();
    p.resizeCanvas(size.w, size.h);
    if (state === "idle") drawIdleScene();
  };

  p.draw = function () {
    if (state === "idle" || state === "done") return;

    const dt = Math.min(p.deltaTime / 1000, 1 / 30);
    globalElapsed += dt;
    const { cx, cy } = panelCenter();
    const rStart = Math.min(p.width / 4, p.height) * 0.36;

    if (state === "inspiral") {
      inspiralElapsed += dt;
      const s = Math.min(inspiralElapsed / inspiralDuration, 1);
      const f = frequencyAt(s);
      orbitalPhase += 2 * Math.PI * f * dt;
      const amp = Math.pow(f / fStart, 2 / 3);
      const r = rStart * Math.pow(fStart / f, 2 / 3);

      const r1 = (r * m2) / mTotal;
      const r2 = (r * m1) / mTotal;
      const x1 = cx + r1 * Math.cos(orbitalPhase);
      const y1 = cy + r1 * Math.sin(orbitalPhase);
      const x2 = cx - r2 * Math.cos(orbitalPhase);
      const y2 = cy - r2 * Math.sin(orbitalPhase);
      lastX1 = x1; lastY1 = y1; lastX2 = x2; lastY2 = y2;

      p.noStroke();
      p.fill(...BG_COLOR, 30);
      p.rect(0, 0, p.width / 2, p.height);

      const rad1 = p.map(m1, 8, 55, 7, 20, true);
      const rad2 = p.map(m2, 8, 55, 7, 20, true);
      drawBlackHole(x1, y1, rad1);
      drawBlackHole(x2, y2, rad2);

      const h = amp * Math.sin(2 * orbitalPhase);
      plotWaveformSample(globalElapsed, h);

      if (s >= 1) {
        state = "merger";
        mergerElapsed = 0;
      }
    } else if (state === "merger") {
      mergerElapsed += dt;
      const tm = Math.min(mergerElapsed / mergerDuration, 1);

      p.noStroke();
      p.fill(...BG_COLOR, 60);
      p.rect(0, 0, p.width / 2, p.height);

      const x1 = p.lerp(lastX1, cx, tm);
      const y1 = p.lerp(lastY1, cy, tm);
      const x2 = p.lerp(lastX2, cx, tm);
      const y2 = p.lerp(lastY2, cy, tm);
      const mergedRad = p.map(mTotal, 16, 110, 12, 30, true);
      const rad1 = p.map(m1, 8, 55, 7, 20, true) * (1 - tm) + mergedRad * tm;
      const rad2 = p.map(m2, 8, 55, 7, 20, true) * (1 - tm) + mergedRad * tm;
      drawBlackHole(x1, y1, rad1);
      drawBlackHole(x2, y2, rad2);

      // brief flash burst at the moment of coalescence
      const flashAlpha = 140 * (1 - tm);
      p.noStroke();
      p.fill(GOLD[0], GOLD[1], GOLD[2], flashAlpha);
      p.circle(cx, cy, mergedRad * 2 + tm * 70);

      // Merger frequency targets fRing/2 here, not fRing directly — this
      // "orbital" phase accumulator gets doubled below for the GW signal
      // (sin(2*orbitalPhase)), matching the convention used in inspiral.
      // Interpolating toward fRing itself would make the GW frequency
      // reach 2*fRing here, mismatching the ringdown's actual fRing.
      orbitalPhase += 2 * Math.PI * p.lerp(frequencyAt(1), fRing / 2, tm) * dt;
      const h = p.lerp(ampAtMerger, peakAmp, tm) * Math.sin(2 * orbitalPhase);
      plotWaveformSample(globalElapsed, h);

      if (mergerElapsed >= mergerDuration) {
        state = "ringdown";
        ringElapsed = 0;
        lastRingSpawnTime = 0;
        // Carry the GW phase over continuously instead of resetting to 0 —
        // physically the phase doesn't jump at merger, only the frequency
        // and amplitude envelope change character.
        ringPhase = (2 * orbitalPhase) % (2 * Math.PI);
      }
    } else if (state === "ringdown") {
      ringElapsed += dt;
      const envelope = peakAmp * Math.exp(-ringElapsed / tau);
      ringPhase += 2 * Math.PI * fRing * dt;
      const h = envelope * Math.sin(ringPhase);

      p.noStroke();
      p.fill(...BG_COLOR, 40);
      p.rect(0, 0, p.width / 2, p.height);

      const mergedRad = p.map(mTotal, 16, 110, 12, 30, true);
      const wobble = 1 + 0.15 * (envelope / peakAmp);
      drawBlackHole(cx, cy, mergedRad * wobble);

      // spawn an expanding, fading ring roughly once per ringdown cycle,
      // timed by real elapsed seconds rather than frame count
      if (ringElapsed - lastRingSpawnTime >= 1 / fRing && rings.length < 4) {
        rings.push({ age: 0 });
        lastRingSpawnTime = ringElapsed;
      }
      const ringLifetime = 1.15; // seconds
      rings.forEach((ring) => (ring.age += dt));
      rings = rings.filter((ring) => ring.age < ringLifetime);
      rings.forEach((ring) => {
        const t = ring.age / ringLifetime;
        p.noFill();
        p.stroke(GOLD[0], GOLD[1], GOLD[2], 120 * (1 - t));
        p.strokeWeight(1.2);
        p.circle(cx, cy, mergedRad * 2 + t * 90);
        p.noStroke();
      });

      plotWaveformSample(globalElapsed, h);

      if (ringElapsed >= ringdownDuration || envelope < peakAmp * 0.01) {
        state = "done";
        p.noLoop();
      }
    }

    drawDivider();
  };
}

new p5(bbhSketch);
