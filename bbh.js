// ============================================================
// Binary Black Hole Merger — instance-mode p5 sketch
// Left panel: inspiral -> merger -> ringdown orbit
// Right panel: corresponding strain waveform, drawn as it plays
// ============================================================

function bbhSketch(p) {
  // Color palette — matches the site's cream / ink / indigo / gold theme
  const BG_COLOR = [250, 243, 232];
  const INK = [26, 23, 18];
  const GOLD = [176, 141, 87];
  const WAVE_COLOR = [43, 46, 119];
  const DIVIDER_COLOR = [26, 23, 18, 50];

  let state = "idle"; // idle -> inspiral -> merger -> ringdown -> done
  let m1 = 30, m2 = 22, mTotal = 52;
  let frame = 0, mergerFrame = 0, ringFrame = 0;
  let orbitalPhase = 0, ringPhase = 0;
  let inspiralFrames = 300, mergerFrames = 16, ringdownFrames = 180;
  const fStart = 0.55;
  let ampAtMerger = 1, peakAmp = 1;
  let fRing = 2, tau = 1;
  let lastX1 = 0, lastY1 = 0, lastX2 = 0, lastY2 = 0;
  let waveformPoints = [];
  let rings = [];
  let totalDurationFrames = 1;
  let waveScale = 60; // recomputed per run so the peak always fits the panel

  function computeCanvasSize() {
    const el = document.getElementById("bbh-container");
    const available = el ? el.offsetWidth : 800;
    const w = Math.max(280, Math.min(800, available));
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
    inspiralFrames = Math.round(p.map(mcClamped, 6, 45, 420, 140));
    mergerFrames = 16;

    fRing = 130 / mTotal;
    const q = 6; // quality factor of the dominant ringdown mode
    tau = Math.min(q / (2 * Math.PI * fRing), 3.0);
    ringdownFrames = Math.min(Math.ceil(4 * tau * 60), 260);

    totalDurationFrames = inspiralFrames + mergerFrames + ringdownFrames;

    frame = 0; mergerFrame = 0; ringFrame = 0;
    orbitalPhase = 0; ringPhase = 0;
    waveformPoints = [];
    rings = [];
    ampAtMerger = Math.pow(frequencyAt(1) / fStart, 2 / 3);
    peakAmp = ampAtMerger * 1.15;
    waveScale = (p.height * 0.42) / peakAmp; // scale so the merger peak fills ~42% of panel height

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
    const x1 = p.map(a.t, 0, totalDurationFrames, p.width / 2, p.width);
    const y1 = p.height / 2 - a.h * waveScale;
    const x2 = p.map(b.t, 0, totalDurationFrames, p.width / 2, p.width);
    const y2 = p.height / 2 - b.h * waveScale;
    p.stroke(WAVE_COLOR[0], WAVE_COLOR[1], WAVE_COLOR[2], 220);
    p.strokeWeight(1.4);
    p.line(x1, y1, x2, y2);
    p.noStroke();
  }

  p.setup = function () {
    const size = computeCanvasSize();
    p.createCanvas(size.w, size.h).parent("bbh-container");
    p.pixelDensity(1);
    p.noStroke();

    p.background(...BG_COLOR);
    drawDivider();
    const { cx, cy } = panelCenter();
    drawBlackHole(cx - 55, cy, 10);
    drawBlackHole(cx + 55, cy, 8);

    const btn = document.getElementById("bbh-randomize-btn");
    if (btn) btn.addEventListener("click", randomizeAndPlay);

    p.noLoop();
  };

  p.windowResized = function () {
    const size = computeCanvasSize();
    p.resizeCanvas(size.w, size.h);
    if (state === "idle") {
      p.background(...BG_COLOR);
      drawDivider();
      const { cx, cy } = panelCenter();
      drawBlackHole(cx - 55, cy, 10);
      drawBlackHole(cx + 55, cy, 8);
    }
  };

  p.draw = function () {
    if (state === "idle" || state === "done") return;

    const dt = Math.min(p.deltaTime / 1000, 1 / 30);
    const { cx, cy } = panelCenter();
    const rStart = Math.min(p.width / 4, p.height) * 0.36;

    if (state === "inspiral") {
      frame++;
      const s = Math.min(frame / inspiralFrames, 1);
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
      plotWaveformSample(frame, h);

      if (s >= 1) {
        state = "merger";
        mergerFrame = 0;
      }
    } else if (state === "merger") {
      mergerFrame++;
      const tm = mergerFrame / mergerFrames;

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

      orbitalPhase += 2 * Math.PI * p.lerp(frequencyAt(1), fRing, tm) * dt;
      const h = p.lerp(ampAtMerger, peakAmp, tm) * Math.sin(2 * orbitalPhase);
      plotWaveformSample(inspiralFrames + mergerFrame, h);

      if (mergerFrame >= mergerFrames) {
        state = "ringdown";
        ringFrame = 0;
        ringPhase = 0;
      }
    } else if (state === "ringdown") {
      ringFrame++;
      const tRing = ringFrame / 60;
      const envelope = peakAmp * Math.exp(-tRing / tau);
      ringPhase += 2 * Math.PI * fRing * dt;
      const h = envelope * Math.sin(ringPhase);

      p.noStroke();
      p.fill(...BG_COLOR, 40);
      p.rect(0, 0, p.width / 2, p.height);

      const mergedRad = p.map(mTotal, 16, 110, 12, 30, true);
      const wobble = 1 + 0.15 * (envelope / peakAmp);
      drawBlackHole(cx, cy, mergedRad * wobble);

      // spawn an expanding, fading ring roughly once per ringdown cycle
      if (ringFrame % Math.max(Math.round(60 / fRing), 4) === 0 && rings.length < 4) {
        rings.push({ age: 0 });
      }
      rings.forEach((ring) => (ring.age += 1));
      rings = rings.filter((ring) => ring.age < 70);
      rings.forEach((ring) => {
        const t = ring.age / 70;
        p.noFill();
        p.stroke(GOLD[0], GOLD[1], GOLD[2], 120 * (1 - t));
        p.strokeWeight(1.2);
        p.circle(cx, cy, mergedRad * 2 + t * 90);
        p.noStroke();
      });

      plotWaveformSample(inspiralFrames + mergerFrames + ringFrame, h);

      if (ringFrame >= ringdownFrames || envelope < peakAmp * 0.01) {
        state = "done";
        p.noLoop();
      }
    }

    drawDivider();
  };
}

new p5(bbhSketch);
