// ============================================================
// Gravitational Lensing — instance-mode p5 sketch
// Compound SIE lens system with convergence (potential) shading
//
// Performance note: the field is computed on a small 128x128
// (or 64x64 on narrow screens) grid, written directly into an
// offscreen pixel buffer, then blitted to the display canvas
// with a single scaled image draw — far cheaper than drawing
// thousands of individual rectangles every frame. The sketch
// also only redraws when something actually changes (drag or
// randomize), not on a perpetual 60fps loop.
// ============================================================

function lensSketch(p) {
  const extent = 5;
  let bins = 128;
  let xs = [];
  let ys = [];

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

  // Offscreen buffers (small, fixed resolution regardless of display size)
  let sourceBuf, lensedBuf, kappaImg;

  function computeCanvasSize() {
    const el = document.getElementById("lens-container");
    const available = el ? el.offsetWidth : 800;
    const w = Math.max(280, Math.min(1200, available));
    return { w, h: w / 2 };
  }

  function binsForWidth(w) {
    if (w < 500) return 64;
    if (w < 900) return 128;
    return 192;
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
    if (psi < 5e-3) psi = 5e-3;
    return b / (2 * psi);
  }

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

  function buildGrids() {
    xs = []; ys = [];
    for (let i = 0; i < bins; i++) {
      xs[i] = p.map(i, 0, bins - 1, -extent, extent);
      ys[i] = p.map(i, 0, bins - 1, -extent, extent);
    }
  }

  function recomputeKappaGrid() {
    kappaGrid = [];
    for (let i = 0; i < bins; i++) {
      kappaGrid[i] = [];
      for (let j = 0; j < bins; j++) kappaGrid[i][j] = totalKappa(xs[j], ys[i]);
    }
    buildKappaImage();
  }

  function makeBuffers() {
    sourceBuf = p.createGraphics(bins, bins);
    lensedBuf = p.createGraphics(bins, bins);
    kappaImg = p.createGraphics(bins, bins);
    [sourceBuf, lensedBuf, kappaImg].forEach((g) => g.pixelDensity(1));
  }

  function buildKappaImage() {
    const kappaCap = 1.2;
    const maxAlpha = 80; // kept deliberately faint
    kappaImg.loadPixels();
    for (let i = 0; i < bins; i++) {
      const row = bins - 1 - i;
      for (let j = 0; j < bins; j++) {
        const idx = 4 * (row * bins + j);
        const k = Math.min(kappaGrid[i][j], kappaCap);
        const alpha = Math.round(p.map(k, 0, kappaCap, 0, maxAlpha));
        kappaImg.pixels[idx] = LENS_COLOR[0];
        kappaImg.pixels[idx + 1] = LENS_COLOR[1];
        kappaImg.pixels[idx + 2] = LENS_COLOR[2];
        kappaImg.pixels[idx + 3] = alpha;
      }
    }
    kappaImg.updatePixels();
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
    p.redraw();
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

  function writeFieldToBuffer(buf, I, color) {
    buf.loadPixels();
    for (let i = 0; i < bins; i++) {
      const row = bins - 1 - i;
      for (let j = 0; j < bins; j++) {
        const idx = 4 * (row * bins + j);
        buf.pixels[idx] = color[0];
        buf.pixels[idx + 1] = color[1];
        buf.pixels[idx + 2] = color[2];
        buf.pixels[idx + 3] = Math.round(p.constrain(I[i][j], 0, 1) * 255);
      }
    }
    buf.updatePixels();
  }

  function renderScene() {
    const Isrc = computeSource();
    const Ilensed = computeLensed(Isrc);
    writeFieldToBuffer(sourceBuf, Isrc, BLOB_COLOR);
    writeFieldToBuffer(lensedBuf, Ilensed, BLOB_COLOR);

    p.background(...BG_COLOR);
    p.image(sourceBuf, 0, 0, p.width / 2, p.height);
    p.image(lensedBuf, p.width / 2, 0, p.width / 2, p.height);
    p.image(kappaImg, p.width / 2, 0, p.width / 2, p.height);

    p.stroke(...DIVIDER_COLOR);
    p.strokeWeight(1);
    p.line(p.width / 2, 0, p.width / 2, p.height);
    p.noStroke();
  }

  function withinLeftPanel(x, y) {
    return x >= 0 && x < p.width / 2 && y >= 0 && y < p.height;
  }

  function updateSourceFromCoords(x, y) {
    sourceX = p.constrain(p.map(x, 0, p.width / 2, -extent, extent), -extent, extent);
    sourceY = p.constrain(p.map(y, 0, p.height, extent, -extent), -extent, extent);
  }

  p.setup = function () {
    const size = computeCanvasSize();
    const canvas = p.createCanvas(size.w, size.h);
    canvas.parent("lens-container");
    canvas.attribute(
      "aria-label",
      "Interactive gravitational lensing simulation. Drag inside the left panel to move the light source."
    );
    bins = binsForWidth(size.w);
    p.pixelDensity(1);
    p.noStroke();
    buildGrids();
    makeBuffers();
    recomputeKappaGrid();

    const btn = document.getElementById("lens-randomize-btn");
    if (btn) btn.addEventListener("click", randomizeLenses);

    p.noLoop();
    p.redraw();
  };

  p.windowResized = function () {
    const size = computeCanvasSize();
    p.resizeCanvas(size.w, size.h);
    const newBins = binsForWidth(size.w);
    if (newBins !== bins) {
      bins = newBins;
      buildGrids();
      makeBuffers();
      recomputeKappaGrid();
    }
    p.redraw();
  };

  p.draw = function () {
    renderScene();
  };

  // ----- Mouse (desktop) -----
  p.mousePressed = function () {
    if (withinLeftPanel(p.mouseX, p.mouseY)) dragging = true;
  };

  p.mouseReleased = function () {
    dragging = false;
  };

  p.mouseDragged = function () {
    if (!dragging) return;
    updateSourceFromCoords(p.mouseX, p.mouseY);
    p.redraw();
  };

  // ----- Touch (mobile) -----
  p.touchStarted = function () {
    if (p.touches.length > 0) {
      const t = p.touches[0];
      if (withinLeftPanel(t.x, t.y)) {
        dragging = true;
        p.redraw();
        return false; // block page scroll only when the touch starts on our panel
      }
    }
  };

  p.touchMoved = function () {
    if (dragging && p.touches.length > 0) {
      const t = p.touches[0];
      updateSourceFromCoords(t.x, t.y);
      p.redraw();
      return false; // block page scroll while actively dragging the source
    }
  };

  p.touchEnded = function () {
    if (dragging) {
      dragging = false;
      return false;
    }
  };
}

new p5(lensSketch);
