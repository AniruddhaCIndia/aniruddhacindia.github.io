let bins = 128;
let extent = 5;
let x = [];
let y = [];

let sourceX = 0.0;
let sourceY = 0.0;
let dragging = false;

let canvas;

// SIE lens parameters
let einsteinRadius = 1.0;
let q = 0.4;
let phi = 0;

function setup() {
  canvas = createCanvas(800, 400);
  canvas.parent("lens-container");

  for (let i = 0; i < bins; i++) {
    x[i] = map(i, 0, bins - 1, -extent, extent);
    y[i] = map(i, 0, bins - 1, -extent, extent);
  }
  pixelDensity(1);
  noStroke();
}

function draw() {
  background(0);

  let I_source = computeSource();
  let I_lensed = computeLensed(I_source);

  drawField(I_source, 0);
  drawField(I_lensed, width / 2);
}

// ===== SOURCE =====
function gaussian(xv, yv, x0, y0, sigma) {
  return Math.exp(-((xv - x0) ** 2 + (yv - y0) ** 2) / (2 * sigma * sigma));
}

function computeSource() {
  let I = [];
  for (let i = 0; i < bins; i++) {
    I[i] = [];
    for (let j = 0; j < bins; j++) {
      I[i][j] = gaussian(x[j], y[i], sourceX, sourceY, 0.15);
    }
  }
  return I;
}

// ===== SIE LENS =====
function lensDeflection(xv, yv) {
  let phiRad = phi * Math.PI / 180;

  // Rotate into lens frame
  let xp = xv * Math.cos(phiRad) + yv * Math.sin(phiRad);
  let yp = -xv * Math.sin(phiRad) + yv * Math.cos(phiRad);

  // Axis ratio safeguard
  let q_safe = constrain(q, 0.05, 0.999);

  // Elliptical radius
  let psi = Math.sqrt(q_safe * q_safe * xp * xp + yp * yp);
  if (psi < 1e-6) psi = 1e-6;

  let eps = Math.sqrt(1 - q_safe * q_safe);

  let axp, ayp;

  if (eps < 1e-4) {
    // Circular limit (SIS)
    axp = einsteinRadius * xp / psi;
    ayp = einsteinRadius * yp / psi;
  } else {
    axp = (einsteinRadius / eps) *
          Math.atan((eps * xp) / psi);

    ayp = (einsteinRadius / eps) *
          Math.atanh((eps * yp) / psi);
  }

  // Rotate back
  let ax = axp * Math.cos(phiRad) - ayp * Math.sin(phiRad);
  let ay = axp * Math.sin(phiRad) + ayp * Math.cos(phiRad);

  return [ax, ay];
}

// ===== LENSED IMAGE (bilinear interpolation) =====
function computeLensed(I_source) {
  let I = [];
  for (let i = 0; i < bins; i++) {
    I[i] = [];
    for (let j = 0; j < bins; j++) {
      let xv = x[j];
      let yv = y[i];

      let [ax, ay] = lensDeflection(xv, yv);

      let bx = xv - ax;
      let by = yv - ay;

      let fx = map(bx, -extent, extent, 0, bins - 1);
      let fy = map(by, -extent, extent, 0, bins - 1);

      let ix = Math.floor(fx);
      let iy = Math.floor(fy);
      let dx = fx - ix;
      let dy = fy - iy;

      if (ix >= 0 && ix < bins - 1 && iy >= 0 && iy < bins - 1) {
        let val =
          (1 - dx) * (1 - dy) * I_source[iy][ix] +
          dx * (1 - dy) * I_source[iy][ix + 1] +
          (1 - dx) * dy * I_source[iy + 1][ix] +
          dx * dy * I_source[iy + 1][ix + 1];

        I[i][j] = val;
      } else {
        I[i][j] = 0;
      }
    }
  }
  return I;
}

// ===== DRAW FIELD =====
function drawField(I, offsetX) {
  let w = width / 2;
  let h = height;

  // 🔥 Force exact pixel-to-grid mapping
  let dx = w / bins;
  let dy = h / bins;

  for (let i = 0; i < bins; i++) {
    for (let j = 0; j < bins; j++) {

      let val = I[i][j];
      let c = map(val, 0, 1, 0, 255);
      fill(c);

      // 🔥 Uniform tiling (no distortion)
      let px = offsetX + j * dx;
      let py = (bins - 1 - i) * dy; // single clean Y flip

      rect(px, py, dx, dy);
    }
  }
}
// ===== DRAGGING =====
function mousePressed() {
  if (mouseX < width / 2) dragging = true;
}

function mouseReleased() {
  dragging = false;
}

function mouseDragged() {
  if (dragging) {
    let w = width / 2;
    let h = height;

    sourceX = map(mouseX, 0, w, -extent, extent);
    sourceY = map(mouseY, 0, h, extent, -extent);

    sourceX = constrain(sourceX, -extent, extent);
    sourceY = constrain(sourceY, -extent, extent);
  }
}
