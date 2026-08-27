// ============================================================
// Gravitational Lensing — instance-mode p5 sketch
// Compound SIE lens system with convergence (potential) shading
// ============================================================

function lensSketch(p) {
  const bins = 128;
  const extent = 5;
  const xs = [];
  const ys = [];

  let sourceX = 0.0;
  let sourceY = 0.0;
  let dragging = false;

  // Color palette — matches the site's cream / ink / indigo / gold theme
  const BG_COLOR = [250, 243, 232];       // cream
  const BLOB_COLOR = [43, 46, 119];       // indigo — light
  const LENS_COLOR = [176, 141, 87];      // gold — mass
  const DIVIDER_COLOR = [26, 23, 18, 50]; // faint ink

  // Default: a single centered SIE lens (matches the original demo)
  let lenses = [{ x0: 0, y0: 0, b: 1.0, q: 0.4, phi: 0 }];
  let kappaGrid = null;

  function computeCanvasSize() {
    const el = document.getElementById("lens-container");
    const available = el ? el.offsetWidth : 800;
    const w = Math.max(280, Math.min(800, available));
    return { w, h: w / 2 };
  }

  // ===== SIE deflection & convergence for a single lens component =====
  function singleDeflection(xv, yv, b, q, phiDeg) {
    const phiRad = (phiDeg * Math.PI) / 180;
    const xp = xv * Math.cos(phiRad) + yv * Math.sin(phiRad);
    const yp = -xv * Math.sin(phiRad) + yv * Math.cos(phiRad);
    const qSafe = Math.min(Math.max(q, 0.05), 0.999);
    let psi = Math.sqrt(qSafe * qSafe * xp * xp + yp * yp);
    if (psi < 1e-6) psi = 1e-6;
    const eps = Math.sqrt(1 - qSafe * qSafe);
    let axp, ayp;
    if (eps < 1e-4) {
      axp = (b * xp) / psi;
      ayp = (b * yp) / psi;
    } else {
      axp = (b / eps) * Math.atan((eps * xp) / psi);
      ayp = (b / eps) * Math.atanh((eps * yp) / psi);
    }
    return [
      axp * Math.cos(phiRad) - ayp * Math.sin(phiRad),
      axp * Math.sin(phiRad) + ayp * Math.cos(phiRad),
    ];
  }

  function singleKappa(xv, yv, b, q, phiDeg) {
    const phiRad = (phiDeg * Math.PI) / 180;
    const xp = xv * Math.cos(phiRad) + yv * Math.sin(phiRad);
    const yp = -xv * Math.sin(phiRad) + yv * Math.cos(phiRad);
    const qSafe = Math.min(Math.max(q, 0.05), 0.999);
    let psi = Math.sqrt(qSafe * qSafe * xp * xp + yp * yp);
    if (psi < 5e-3) psi = 5e-3; // floor so the cusp doesn't blow out the shading
    return b / (2 * psi);
  }

  // Superposition: deflections and convergence add linearly across lens components
  function totalDeflection(xv, yv) {
    let ax = 0, ay = 0;
    for (const L of lenses) {
      const [dax, day] = singleDeflection(xv - L.x0, yv - L.y0, L.b, L.q, L.phi);
      ax += dax; ay += day;
    }
    return [ax, ay];
  }

  function totalKappa(xv, yv) {
    let k = 0;
    for (const L of lenses) k += singleKappa(xv - L.x0, yv - L.y0, L.b, L.q, L.phi);
    return k;
  }

  function recomputeKappaGrid() {
    kappaGrid = [];
    for (let i = 0; i < bins; i++) {
      kappaGrid[i] = [];
      for (let j = 0; j < bins; j++) {
        kappaGrid[i][j] = totalKappa(xs[j], ys[i]);
      }
    }
  }

  function randomizeLenses() {
    const count = Math.floor(p.random(2, 8)); // 2–7 sub-lenses
    const newLenses = [];
    for (let i = 0; i < count; i++) {
      const angle = p.random(0, Math.PI * 2);
      const dist = p.random(0, 1.4); // keeps the cluster compact
      newLenses.push({
        x0: dist * Math.cos(angle),
        y0: dist * Math.sin(angle),
        b: p.random(0.25, 0.55),
        q: p.random(0.3, 0.9),
        phi: p.random(0, 180),
      });
    }
    lenses = newLenses;
    recomputeKappaGrid();
    sourceX = 0;
    sourceY = 0;
  }

  // ===== Source =====
  function gaussian(xv, yv, x0, y0, sigma) {
    return Math.exp(-((xv - x0) ** 2 + (yv - y0) ** 2) / (2 * sigma * sigma));
  }

  function computeSource() {
    const I = [];
    for (let i = 0; i < bins; i++) {
      I[i] = [];
      for (let j = 0; j < bins; j++) I[i][j] = gaussian(xs[j], ys[i], sourceX, sourceY, 0.15);
    }
    return I;
  }

  function computeLensed(Isrc) {
    const I = [];
    for (let i = 0; i < bins; i++) {
      I[i] = [];
      for (let j = 0; j < bins; j++) {
        const [ax, ay] = totalDeflection(xs[j], ys[i]);
        const bx = xs[j] - ax;
        const by = ys[i] - ay;
        const fx = p.map(bx, -extent, extent, 0, bins - 1);
        const fy = p.map(by, -extent, extent, 0, bins - 1);
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const dx = fx - ix, dy = fy - iy;
        if (ix >= 0 && ix < bins - 1 && iy >= 0 && iy < bins - 1) {
          I[i][j] =
            (1 - dx) * (1 - dy) * Isrc[iy][ix] +
            dx * (1 - dy) * Isrc[iy][ix + 1] +
            (1 - dx) * dy * Isrc[iy + 1][ix] +
            dx * dy * Isrc[iy + 1][ix + 1];
        } else {
          I[i][j] = 0;
        }
      }
    }
    return I;
  }

  function drawField(I, offsetX, color) {
    const w = p.width / 2, h = p.height;
    const dx = w / bins, dy = h / bins;
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const alpha = p.map(I[i][j], 0, 1, 0, 255);
        p.fill(color[0], color[1], color[2], alpha);
        p.rect(offsetX + j * dx, (bins - 1 - i) * dy, dx, dy);
      }
    }
  }

  // Faint, semi-transparent overlay showing where the lens mass sits
  function drawKappaOverlay(offsetX) {
    const w = p.width / 2, h = p.height;
    const dx = w / bins, dy = h / bins;
    const kappaCap = 1.2;
    const maxAlpha = 80; // kept deliberately faint
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const k = Math.min(kappaGrid[i][j], kappaCap);
        const alpha = p.map(k, 0, kappaCap, 0, maxAlpha);
        if (alpha < 2) continue; // skip near-invisible cells, cheap perf win
        p.fill(LENS_COLOR[0], LENS_COLOR[1], LENS_COLOR[2], alpha);
        p.rect(offsetX + j * dx, (bins - 1 - i) * dy, dx, dy);
      }
    }
  }

  p.setup = function () {
    const size = computeCanvasSize();
    p.createCanvas(size.w, size.h).parent("lens-container");
    for (let i = 0; i < bins; i++) {
      xs[i] = p.map(i, 0, bins - 1, -extent, extent);
      ys[i] = p.map(i, 0, bins - 1, -extent, extent);
    }
    p.pixelDensity(1);
    p.noStroke();
    recomputeKappaGrid();

    const btn = document.getElementById("lens-randomize-btn");
    if (btn) btn.addEventListener("click", randomizeLenses);
  };

  p.windowResized = function () {
    const size = computeCanvasSize();
    p.resizeCanvas(size.w, size.h);
  };

  p.draw = function () {
    p.background(...BG_COLOR);
    const Isrc = computeSource();
    const Ilensed = computeLensed(Isrc);
    drawField(Isrc, 0, BLOB_COLOR);
    drawField(Ilensed, p.width / 2, BLOB_COLOR);
    drawKappaOverlay(p.width / 2);

    p.stroke(...DIVIDER_COLOR);
    p.strokeWeight(1);
    p.line(p.width / 2, 0, p.width / 2, p.height);
    p.noStroke();
  };

  p.mousePressed = function () {
    if (p.mouseX < p.width / 2) dragging = true;
  };

  p.mouseReleased = function () {
    dragging = false;
  };

  p.mouseDragged = function () {
    if (!dragging) return;
    sourceX = p.constrain(p.map(p.mouseX, 0, p.width / 2, -extent, extent), -extent, extent);
    sourceY = p.constrain(p.map(p.mouseY, 0, p.height, extent, -extent), -extent, extent);
  };
}

new p5(lensSketch);
