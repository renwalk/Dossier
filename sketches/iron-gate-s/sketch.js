// Iron scroll "S"
// mouse right = spiral in | left = spiral out | up = branch | down = line weight

let turns = 1.8, branch = 0, wt = 3;

function setup() {
  createCanvas(windowWidth, windowHeight);
  strokeCap(ROUND);
  noFill();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(50);
  stroke(255);

  // mouse -> targets, eased so the line moves organically
  let nx = constrain(mouseX / width, 0, 1);
  let ny = constrain(mouseY / height, 0, 1);
  turns  = lerp(turns,  lerp(1.1, 3.4, nx), 0.08);
  branch = lerp(branch, ny < 0.5 ? map(ny, 0.5, 0.05, 0, 3, true) : 0, 0.08);
  wt     = lerp(wt,     ny > 0.5 ? map(ny, 0.5, 0.95, 3, 14, true) : 3, 0.08);

  translate(width / 2, height / 2);
  let R = min(width, height) * 0.2;

  // S = two mirrored spirals joined at the middle
  let half = [], n = floor(110 * turns) + 40;
  for (let i = 0; i <= n; i++) {
    let u = 1 - i / n;
    let th = HALF_PI + TWO_PI * turns * u;
    let r = R * (0.1 + 0.9 * (1 - u));
    r *= 1 + 0.12 * (noise(i * 0.03, frameCount * 0.01) - 0.5); // gentle wobble
    half.push(createVector(r * cos(th), -R + r * sin(th)));
  }
  let pts = half.slice();
  for (let i = half.length - 2; i >= 0; i--) pts.push(createVector(-half[i].x, -half[i].y));

  // thin at the tips, thick through the middle
  let N = pts.length;
  drawLine(pts, i => wt * (0.3 + 0.7 * constrain(min(i, N - 1 - i) / (N * 0.2), 0, 1)));
  branches(pts, 0, R * 0.6, wt, 1);
}

// deterministic 0..1 "random" so each branch keeps its own shape between frames
function rnd(a, b) {
  let x = sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - floor(x);
}

function branches(pts, depth, r, w, seed) {
  let N = pts.length;
  let count = depth === 0 ? 9 : 3;

  for (let j = 0; j < count; j++) {
    // each branch sprouts at its own moment, so they appear one by one
    let grow = constrain(branch - depth - rnd(seed, j + 50) * 0.5, 0, 1);
    if (grow < 0.01) continue;

    let f = depth === 0
      ? lerp(0.07, 0.93, (j + 0.2 + 0.6 * rnd(seed, j)) / count)
      : lerp(0.25, 0.85, (j + rnd(seed, j)) / count);
    let i = constrain(floor(f * (N - 1)), 3, N - 4);

    let T = p5.Vector.sub(pts[i + 1], pts[i - 1]).normalize();
    let a = p5.Vector.sub(pts[i], pts[i - 3]);
    let b = p5.Vector.sub(pts[i + 3], pts[i]);
    let s = a.x * b.y - a.y * b.x >= 0 ? 1 : -1;

    // per-branch variety: size, angle, number of curls, curl direction
    let size   = r * (0.6 + 0.9 * rnd(seed, j + 10)) * grow;
    let angle  = 0.5 + 0.9 * rnd(seed, j + 20);
    let dir    = rnd(seed, j + 30) < 0.3 ? s : -s;
    let cturns = 0.7 + 1.4 * rnd(seed, j + 40) + 0.1 * turns;

    let out = createVector(s * T.y, -s * T.x);
    let h = p5.Vector.add(p5.Vector.mult(T, cos(angle)), p5.Vector.mult(out, sin(angle)));

    let m = 80, child = [];
    let rel = createVector(dir * h.y, -dir * h.x);
    let c = p5.Vector.sub(pts[i], p5.Vector.mult(rel, size));
    let th0 = atan2(rel.y, rel.x);
    for (let k = 0; k <= m; k++) {
      let t = k / m;
      let rad = size * (1 - 0.88 * t) * (1 + 0.1 * (noise(k * 0.08, i, frameCount * 0.01) - 0.5));
      let th = th0 + dir * TWO_PI * cturns * t;
      child.push(createVector(c.x + rad * cos(th), c.y + rad * sin(th)));
    }
    let w0 = w * 0.75 * grow;
    drawLine(child, k => w0 * (1 - 0.7 * k / m));
    branches(child, depth + 1, size * 0.55, w0, seed * 7 + j + 1);
  }
}

function drawLine(pts, weightAt) {
  for (let i = 0; i < pts.length - 1; i++) {
    strokeWeight(max(0.5, weightAt(i)));
    line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }
}
