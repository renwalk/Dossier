let data;

// Low-precision lunar orbit elements (Paul Schlyter's mean-element model) used
// to approximate the Moon's current geocentric distance and equatorial
// position (RA/Dec). No perturbation terms -- accurate to roughly 1-2%, good
// enough for a dashboard readout, not for navigation.
const EARTH_RADIUS_KM = 6378.14;
const MOON_PERIGEE_KM = 356500; // closest approach used to scale the Distance slider
const MOON_APOGEE_KM = 406700; // farthest approach used to scale the Distance slider
const MOON_DIAMETER_KM = 3474.8;
const KM_TO_MILES = 0.621371;

let useCurrentCheckbox, playButton, statusDot;
let titleSubtitle, telPhase, telIllum, telDistance, telAngular, telLimbAngle, telLocation;
let moonThumb, thumbGfx;

let moonPhaseSlider, moonPhaseGroup;
let reflectionsSlider, ringsSlider, sizeSlider, angleGroup, angleSlider, distanceGroup, distanceSlider, opacitySlider, speedSlider;
let isPlaying = false;

// Observer location for the parallactic (bright-limb) angle. Populated
// asynchronously by the Geolocation API; angle mapping is skipped until it
// resolves (or stays skipped forever if the user denies/lacks support).
let observerLat = null, observerLon = null, geoStatus = 'locating';

function preload() {
  let today = new Date();
  let month = ('0' + (today.getMonth() + 1)).slice(-2);
  let day = ('0' + today.getDate()).slice(-2);
  let dateStr = today.getFullYear() + '-' + month + '-' + day;
  const url = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/Philadelphia,PA/' + dateStr + '?unitGroup=us&key=9MXXYW449LTYGB7EEG4Q8HBK2&include=days&elements=datetime,moonphase&contentType=json';
  data = loadJSON(url);
}

function setup() {
  wireStaticControls();
  buildSliders();
  requestGeolocation();

  let canvasContainer = select('#canvas-container');
  let cnv = createCanvas(700, 700);
  cnv.parent(canvasContainer);

  moonThumb = select('#moon-thumb');
  thumbGfx = createGraphics(moonThumb.width, moonThumb.height);
  thumbGfx.parent(moonThumb);
  thumbGfx.elt.style.display = 'block'; // createGraphics canvases default to display:none

  angleMode(DEGREES);
  noStroke();
}

// Browser geolocation is required for the parallactic angle (it depends on
// the observer's lat/lon), unlike distance which is purely geocentric.
function requestGeolocation() {
  if (!navigator.geolocation) {
    geoStatus = 'unsupported';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      observerLat = pos.coords.latitude;
      observerLon = pos.coords.longitude;
      geoStatus = 'ok';
    },
    () => { geoStatus = 'denied'; },
    { maximumAge: 600000, timeout: 10000 }
  );
}

function wireStaticControls() {
  statusDot = select('#status-dot');
  titleSubtitle = select('#title-subtitle');
  telPhase = select('#tel-phase');
  telIllum = select('#tel-illum');
  telDistance = select('#tel-distance');
  telAngular = select('#tel-angular');
  telLimbAngle = select('#tel-limb');
  telLocation = select('#tel-location');

  useCurrentCheckbox = checkboxRow(select('#checkbox-slot'), 'Use current moon phase', true);
  useCurrentCheckbox.changed(() => {
    let useCurrent = useCurrentCheckbox.elt.checked;
    moonPhaseSlider.elt.disabled = useCurrent;
    angleSlider.elt.disabled = useCurrent;
    distanceSlider.elt.disabled = useCurrent;
  });

  playButton = select('#play-button');
  playButton.mousePressed(togglePlay);
}

function buildSliders() {
  let container = select('#sliders');

  moonPhaseGroup = sliderRow(container, 'Moon phase', 0, 1, 0.22, 0.001);
  moonPhaseSlider = moonPhaseGroup.slider;
  moonPhaseSlider.elt.disabled = true; // matches checkbox default (checked)

  reflectionsSlider = sliderRow(container, 'Reflections', 2, 24, 8, 1).slider;

  angleGroup = sliderRow(container, 'Angle', 0, 360, 0, 1);
  angleSlider = angleGroup.slider;
  angleSlider.elt.disabled = true; // matches checkbox default (checked)

  ringsSlider = sliderRow(container, 'Rings', 1, 8, 3, 1).slider;
  sizeSlider = sliderRow(container, 'Size', 10, 120, 50, 1).slider;
  opacitySlider = sliderRow(container, 'Opacity', 0, 255, 255, 1).slider;
  speedSlider = sliderRow(container, 'Speed', 0.0005, 0.02, 0.0025, 0.0005).slider;

  distanceGroup = sliderRow(container, 'Distance', 10, 100, 60, 1);
  distanceSlider = distanceGroup.slider;
  distanceSlider.elt.disabled = true; // matches checkbox default (checked)
}

// Custom checkbox (Figma dashboard style): a plain <label> wrapping a fully
// transparent native checkbox for real interaction, plus decorative
// box/text spans that react to it purely via CSS sibling selectors.
function checkboxRow(parent, label, checked) {
  let row = createElement('label');
  row.parent(parent);
  row.class('checkbox-row');

  let input = createElement('input');
  input.parent(row);
  input.attribute('type', 'checkbox');
  input.elt.checked = checked;

  let box = createDiv();
  box.parent(row);
  box.class('checkbox-box');

  let text = createSpan(label);
  text.parent(row);
  text.class('checkbox-text');

  return input;
}

function togglePlay() {
  isPlaying = !isPlaying;
  playButton.html('<span class="play-icon">' + (isPlaying ? '❚❚' : '▶') + '</span> ' + (isPlaying ? 'Pause' : 'Play'));
  statusDot.class(isPlaying ? 'status-dot active' : 'status-dot');

  if (isPlaying) {
    // Animating the phase only makes sense against the manual slider.
    useCurrentCheckbox.elt.checked = false;
    useCurrentCheckbox.elt.disabled = true;
    moonPhaseSlider.elt.disabled = false;
    angleSlider.elt.disabled = false;
    distanceSlider.elt.disabled = false;
  } else {
    useCurrentCheckbox.elt.disabled = false;
  }
}

// Builds the thin-line "sci-fi" slider look (Figma dashboard style): a
// background line, a filled portion, and a tick mark, all driven from a
// fully transparent native range input layered on top to keep real
// drag/keyboard accessibility.
function sliderRow(parent, label, min, max, val, step) {
  let row = createDiv();
  row.parent(parent);
  row.class('control-row');

  let labelSpan = createSpan(label);
  labelSpan.parent(row);
  labelSpan.class('control-label');

  let track = createDiv();
  track.parent(row);
  track.class('slider-track');

  let trackBg = createDiv();
  trackBg.parent(track);
  trackBg.class('slider-track-bg');

  let fill = createDiv();
  fill.parent(trackBg);
  fill.class('slider-track-fill');

  let tick = createDiv();
  tick.parent(trackBg);
  tick.class('slider-thumb-tick');

  let slider = createSlider(min, max, val, step);
  slider.parent(track);

  let valueSpan = createSpan(String(val));
  valueSpan.parent(row);
  valueSpan.class('control-value');

  function refresh() {
    let pct = ((slider.value() - min) / (max - min)) * 100;
    fill.style('width', pct + '%');
    tick.style('left', pct + '%');
    valueSpan.html(slider.value());
  }

  slider.input(refresh);
  refresh();

  return { row, slider, valueSpan, refresh };
}

function draw() {
  background(10);

  if (isPlaying) {
    let next = moonPhaseSlider.value() + speedSlider.value();
    if (next >= 1) next -= 1;
    moonPhaseSlider.value(next);
    moonPhaseGroup.refresh(); // updates the track fill/tick position too, not just the number
  }

  let usingCurrent = useCurrentCheckbox.elt.checked && data;
  let moonPhase = usingCurrent ? data.days[0].moonphase : moonPhaseSlider.value();
  let pos = moonOrbitPosition(new Date());

  if (usingCurrent) {
    applyRealAngleAndDistance(pos);
  }

  let reflections = reflectionsSlider.value();
  let rings = ringsSlider.value();
  let size = sizeSlider.value();
  let angle = angleSlider.value();
  let distance = distanceSlider.value();
  let opacity = opacitySlider.value();

  let segAngle = 360 / reflections;

  push();
  translate(width / 2, height / 2 - 20);

  for (let r = 0; r < rings; r++) {
    let radius = distance * (r + 1);
    // Alternate rings offset by half a segment for a woven, flower-like look.
    let weaveOffset = r % 2 === 1 ? segAngle / 2 : 0;

    for (let i = 0; i < reflections; i++) {
      push();
      rotate(i * segAngle + weaveOffset); // fixes each motif's position around the ring
      translate(radius, 0);
      // Mirror every other segment for true kaleidoscope symmetry.
      if (i % 2 === 1) scale(-1, 1);
      rotate(angle); // spins the motif in place, independent of its position
      drawMoonOn(window, 0, 0, size, moonPhase, opacity);
      pop();
    }
  }
  pop();

  drawThumbnail(moonPhase);
  updateTelemetry(moonPhase, pos);
}

// Maps real geocentric distance onto the Distance slider's range, and (when
// the observer's location is known) real parallactic angle onto the Angle
// slider's range -- both slider ranges already line up 1:1 with the data.
function applyRealAngleAndDistance(pos) {
  let distT = constrain((pos.distanceKm - MOON_PERIGEE_KM) / (MOON_APOGEE_KM - MOON_PERIGEE_KM), 0, 1);
  distanceGroup.slider.value(Math.round(10 + distT * 90));
  distanceGroup.refresh();

  if (observerLat !== null) {
    let q = parallacticAngleDeg(new Date(), pos.raDeg, pos.decDeg, observerLat, observerLon);
    angleGroup.slider.value(Math.round(normalizeDeg(q)));
    angleGroup.refresh();
  }
}

function drawThumbnail(moonPhase) {
  thumbGfx.background(0);
  thumbGfx.noStroke();
  let d = min(thumbGfx.width, thumbGfx.height) * 0.8;
  let cx = thumbGfx.width / 2;
  let cy = thumbGfx.height / 2;

  // Unlike the main flower (which needs the night side fully transparent so
  // overlapping petals blend), the thumbnail is a single icon: it needs a
  // visible disc behind the crescent (fill + outline) so thin phases still
  // read clearly instead of nearly disappearing against a plain black square.
  thumbGfx.stroke(255, 220);
  thumbGfx.strokeWeight(2);
  thumbGfx.fill(110);
  thumbGfx.ellipse(cx, cy, d, d);
  thumbGfx.noStroke();

  drawMoonOn(thumbGfx, cx, cy, d, moonPhase, 255);
}

function updateTelemetry(moonPhase, pos) {
  let name = phaseLabel(moonPhase);
  let illumPct = round(((1 - cos(moonPhase * 360)) / 2) * 100);

  let distanceMiles = pos.distanceKm * KM_TO_MILES;
  let angularArcsec = angularDiameterArcsec(pos.distanceKm);

  titleSubtitle.html('Kaleidoscope · ' + name);
  telPhase.html(name);
  telIllum.html(illumPct + '%');
  telDistance.html(Math.round(distanceMiles).toLocaleString() + ' mi');
  telAngular.html(angularArcsec.toFixed(1) + ' arcsec');

  if (observerLat !== null) {
    let q = parallacticAngleDeg(new Date(), pos.raDeg, pos.decDeg, observerLat, observerLon);
    telLimbAngle.html(Math.round(normalizeDeg(q)) + '°');
    telLocation.html(observerLat.toFixed(1) + '°, ' + observerLon.toFixed(1) + '°');
  } else {
    telLimbAngle.html('—');
    telLocation.html(geoStatus === 'denied' ? 'denied' : geoStatus === 'unsupported' ? 'unsupported' : 'locating…');
  }
}

// Low-precision geocentric lunar position (Paul Schlyter's mean-element
// model, no perturbation terms): solves Kepler's equation for the Moon's own
// orbit around Earth, then rotates into ecliptic and equatorial coordinates.
// Angles are handled by p5's trig functions, which respect angleMode(DEGREES).
function moonOrbitPosition(date) {
  let JD = date.getTime() / 86400000 + 2440587.5;
  let d = JD - 2451543.5; // days since 1999 Dec 31.0 UT (Schlyter's epoch)

  let N = normalizeDeg(125.1228 - 0.0529538083 * d); // long. of ascending node
  let inc = 5.1454; // inclination
  let w = normalizeDeg(318.0634 + 0.1643573223 * d); // argument of perigee
  let a = 60.2666; // mean distance, Earth radii
  let e = 0.0549; // eccentricity
  let M = normalizeDeg(115.3654 + 13.0649929509 * d); // mean anomaly

  let E = M + (180 / PI) * e * sin(M) * (1 + e * cos(M));
  for (let iter = 0; iter < 5; iter++) {
    E -= (E - (180 / PI) * e * sin(E) - M) / (1 - e * cos(E));
  }

  let xv = a * (cos(E) - e);
  let yv = a * Math.sqrt(1 - e * e) * sin(E);
  let r = Math.sqrt(xv * xv + yv * yv); // Earth radii
  let v = normalizeDeg(atan2(yv, xv)); // true anomaly

  let xeclip = r * (cos(N) * cos(v + w) - sin(N) * sin(v + w) * cos(inc));
  let yeclip = r * (sin(N) * cos(v + w) + cos(N) * sin(v + w) * cos(inc));
  let zeclip = r * sin(v + w) * sin(inc);

  let lonEcl = normalizeDeg(atan2(yeclip, xeclip));
  let latEcl = atan2(zeclip, Math.sqrt(xeclip * xeclip + yeclip * yeclip));
  let obliquity = 23.4393 - 3.563e-7 * d;

  let xeq = cos(lonEcl) * cos(latEcl);
  let yeq = sin(lonEcl) * cos(latEcl) * cos(obliquity) - sin(latEcl) * sin(obliquity);
  let zeq = sin(lonEcl) * cos(latEcl) * sin(obliquity) + sin(latEcl) * cos(obliquity);

  return {
    distanceKm: r * EARTH_RADIUS_KM,
    raDeg: normalizeDeg(atan2(yeq, xeq)),
    decDeg: atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq))
  };
}

// Position angle of the Moon's bright limb as seen from a given point on
// Earth -- depends on the observer's latitude/longitude (via local sidereal
// time -> hour angle) as well as the Moon's RA/Dec. Same quantity that makes
// a crescent look like a "smile" near the equator and more vertical at high
// latitudes.
function parallacticAngleDeg(date, raDeg, decDeg, latDeg, lonDeg) {
  let hourAngleDeg = normalizeDeg(localSiderealHours(date, lonDeg) * 15 - raDeg);
  let numerator = sin(hourAngleDeg);
  let denominator = tan(decDeg) * cos(latDeg) - sin(latDeg) * cos(hourAngleDeg);
  return atan2(numerator, denominator);
}

// Greenwich Mean Sidereal Time (USNO formula), shifted to the observer's
// longitude to get Local Sidereal Time, in hours.
function localSiderealHours(date, lonDeg) {
  let JD = date.getTime() / 86400000 + 2440587.5;
  let JD0 = Math.floor(JD - 0.5) + 0.5; // JD at the previous 0h UT
  let hoursSinceMidnightUTC = (JD - JD0) * 24;
  let T0 = (JD0 - 2451545.0) / 36525;
  let gmst0 = 6.697374558 + 2400.051336 * T0 + 0.000025862 * T0 * T0;
  let gmst = gmst0 + hoursSinceMidnightUTC * 1.0027379093;
  return ((gmst % 24) + 24) % 24;
}

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDiameterArcsec(distanceKm) {
  let angleRad = 2 * Math.atan((MOON_DIAMETER_KM / 2) / distanceKm);
  return angleRad * (180 / Math.PI) * 3600;
}

function phaseLabel(p) {
  if (p < 0.01 || p > 0.99) return 'New Moon';
  if (p < 0.25) return 'Waxing Crescent';
  if (p < 0.26) return 'First Quarter';
  if (p < 0.49) return 'Waxing Gibbous';
  if (p < 0.51) return 'Full Moon';
  if (p < 0.74) return 'Waning Gibbous';
  if (p < 0.76) return 'Last Quarter';
  return 'Waning Crescent';
}

// Draws only the illuminated sliver as a single closed shape (no dark disc
// underneath), so overlapping petals in the kaleidoscope blend instead of
// one moon's night side opaquely covering the moons behind it.
// `g` is either `window` (the global p5 instance, for the main canvas) or a
// p5.Graphics buffer (for the sidebar thumbnail) -- both expose the same
// fill/beginShape/vertex/endShape API.
function drawMoonOn(g, cx, cy, moonSize, moonPhase, opacity) {
  let r = moonSize / 2;
  let fixedSign = moonPhase <= 0.5 ? 1 : -1; // which side stays lit (right/left)
  // Signed horizontal reach of the terminator: same side as fixedSign and
  // near +r for a thin crescent hugging the edge; opposite side and near
  // -r for a nearly-full moon bulging into the other half.
  let termX = fixedSign * r * Math.cos(moonPhase * 2 * Math.PI);

  g.fill(255, opacity);
  g.beginShape();
  for (let thetaDeg = 0; thetaDeg <= 180; thetaDeg += 6) {
    let t = thetaDeg * Math.PI / 180;
    g.vertex(cx + fixedSign * r * Math.sin(t), cy - r * Math.cos(t));
  }
  for (let thetaDeg = 180; thetaDeg >= 0; thetaDeg -= 6) {
    let t = thetaDeg * Math.PI / 180;
    g.vertex(cx + termX * Math.sin(t), cy - r * Math.cos(t));
  }
  g.endShape('close');
}
