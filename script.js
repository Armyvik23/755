/**
 * 755th Transportation Company — Cinematic Scroll Engine
 *
 * Scroll-driven animation system with:
 *   • Parallax depth layers (sky, mountains, hills, road, vehicle, fg)
 *   • Perspective / camera movement (scene tilt, zoom, pan)
 *   • Atmospheric effects (sky color, dust, lighting, sun position)
 *   • Film grain, HUD updates, scene title cards
 *   • 6 scroll segments → 4 cinematic scenes
 */

/* ── Element refs ───────────────────────────────── */
const sky          = document.getElementById('sky');
const sunEl        = document.getElementById('sun');
const sunFlare     = document.getElementById('sun-flare');
const mtFar        = document.getElementById('mountains-far');
const hillsNear    = document.getElementById('hills-near');
const dust         = document.getElementById('dust');
const roadWrap     = document.getElementById('road-wrap');
const groundFg     = document.getElementById('ground-fg');
const vehicleWrap  = document.getElementById('vehicle-wrap');
const vehicleSvg   = document.getElementById('vehicle-svg');
const fgFoliage    = document.getElementById('fg-foliage');
const scene        = document.getElementById('scene');
const scrollFill   = document.getElementById('scroll-fill');
const missionVal   = document.getElementById('mission-val');
const coordLat     = document.getElementById('coord-lat');
const coordLon     = document.getElementById('coord-lon');
const grainCanvas  = document.getElementById('grain-canvas');
const grainCtx     = grainCanvas.getContext('2d');
const titles       = document.querySelectorAll('.scene-title');
const scrollRoot   = document.getElementById('scroll-root');

/* ── Scene definitions ──────────────────────────── */
/**
 * Each scene spans a portion of the total scroll range (0–1).
 * Cinematic prompts drive layer offsets, camera transforms,
 * sky color, and title cards.
 *
 *  SCENE 0 (0.00–0.25)  — DAWN DEPLOYMENT
 *    Prompt: Wide establishing shot, low-angle dawn light.
 *    Camera pulls back slowly. M1088 emerges from darkness.
 *    Parallax: sky drifts up, mountains slide in from depth.
 *
 *  SCENE 1 (0.25–0.50)  — FORWARD LOGISTICS
 *    Prompt: Medium shot, camera tracks alongside the vehicle.
 *    Parallax accelerates. Dust haze rises. Sun climbs horizon.
 *    Vehicle drifts right (convoy passing camera).
 *
 *  SCENE 2 (0.50–0.75)  — STEEL MOVEMENT
 *    Prompt: Low angle, ground-level camera dolly.
 *    Road perspective deepens. Camera tilts forward (nose-down).
 *    Vehicle grows as camera approaches. Motion blur.
 *
 *  SCENE 3 (0.75–1.00)  — MISSION COMPLETE
 *    Prompt: Hero shot — sun behind vehicle, silhouette.
 *    Camera cranes up and zooms out. Everything converges to center.
 */
const SCENES = [
  {
    title: 'title-0',
    mission: 'CONVOY OPS – DAWN',
    skyStart: '#060e1a',
    skyEnd:   '#1a3a5c',
  },
  {
    title: 'title-1',
    mission: 'FWD LOG PUSH',
    skyStart: '#1a3a5c',
    skyEnd:   '#2a6090',
  },
  {
    title: 'title-2',
    mission: 'EN ROUTE – OSCAR MIKE',
    skyStart: '#2a6090',
    skyEnd:   '#4a80a8',
  },
  {
    title: 'title-3',
    mission: 'OBJ REACHED – ENDEX',
    skyStart: '#4a80a8',
    skyEnd:   '#c07030',
  },
];

/* ── Easing helpers ─────────────────────────────── */
const ease   = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;          // easeInOut quad
const easeIO = t => t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1; // easeInOut cubic
const clamp  = (v,mn,mx) => Math.min(mx, Math.max(mn, v));
const lerp   = (a,b,t) => a + (b-a)*t;

/** Map value from [in0,in1] to [out0,out1], clamped */
function mapRange(val, in0, in1, out0, out1, easeFn = null) {
  let t = clamp((val - in0) / (in1 - in0), 0, 1);
  if (easeFn) t = easeFn(t);
  return lerp(out0, out1, t);
}

/** Hex to rgb components */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a, b, t) {
  const ra = hexRgb(a), rb = hexRgb(b);
  const r = Math.round(lerp(ra[0], rb[0], t));
  const g = Math.round(lerp(ra[1], rb[1], t));
  const bl= Math.round(lerp(ra[2], rb[2], t));
  return `rgb(${r},${g},${bl})`;
}

/* ── Scroll state ───────────────────────────────── */
let scrollPct = 0;   // 0–1 over full scroll height
let ticking   = false;

function getScrollPct() {
  const maxScroll = scrollRoot.scrollHeight - window.innerHeight;
  return maxScroll > 0 ? clamp(window.scrollY / maxScroll, 0, 1) : 0;
}

/* ── Main animation update ──────────────────────── */
function updateScene(pct) {
  const p = pct;                     // alias
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* ── Progress bar ─────────────────────────────── */
  scrollFill.style.width = `${p * 100}%`;

  /* ── Scene detection (4 quarters) ──────────────── */
  const sceneIdx = clamp(Math.floor(p * 4), 0, 3);
  titles.forEach((t, i) => {
    const inRange = i === sceneIdx;
    t.classList.toggle('active', inRange);
  });
  missionVal.textContent = SCENES[sceneIdx].mission;

  /* ── Coordinates (live increment) ──────────────── */
  const baseLat = 34 + mapRange(p, 0, 1, 12.30, 18.75) / 60;
  const baseLon = 68 + mapRange(p, 0, 1, 45.22, 52.10) / 60;
  const latD = Math.floor(baseLat);
  const latM = Math.floor((baseLat - latD) * 60);
  const latS = Math.floor(((baseLat - latD) * 60 - latM) * 60);
  const lonD = Math.floor(baseLon);
  const lonM = Math.floor((baseLon - lonD) * 60);
  const lonS = Math.floor(((baseLon - lonD) * 60 - lonM) * 60);
  coordLat.textContent = `LAT: ${latD}°${String(latM).padStart(2,'0')}'${String(latS).padStart(2,'0')}"N`;
  coordLon.textContent = `LON: ${lonD}°${String(lonM).padStart(2,'0')}'${String(lonS).padStart(2,'0')}"E`;

  /* ════════════════════════════════════════════════
     SKY — gradient morph through 4 states
     Prompt: atmospheric depth cue, time-of-day shift
  ════════════════════════════════════════════════ */
  const skyColors = [
    { top: '#030812', mid: '#060e1a', bot: '#0d1a2e' },   // pre-dawn
    { top: '#060e1a', mid: '#1a3a5c', bot: '#3a5a30' },   // dawn
    { top: '#0d2040', mid: '#2a6090', bot: '#4a7840' },   // morning
    { top: '#1a3860', mid: '#4a7ab0', bot: '#c07030' },   // golden hour
  ];
  const si = clamp(p * 3, 0, 2.999);
  const si0 = Math.floor(si), si1 = Math.min(si0+1, 3);
  const st = si - si0;
  const sc0 = skyColors[si0], sc1 = skyColors[si1];
  sky.style.background = `linear-gradient(180deg,
    ${lerpColor(sc0.top, sc1.top, st)} 0%,
    ${lerpColor(sc0.mid, sc1.mid, st)} 40%,
    ${lerpColor(sc0.bot, sc1.bot, st)} 100%
  )`;

  /* ════════════════════════════════════════════════
     SUN — rises from horizon, arc movement
     Depth prompt: diffuse backlight, lens flare growth
  ════════════════════════════════════════════════ */
  const sunTop  = mapRange(p, 0, 1, 85, 25, ease);   // % from top (rises)
  const sunLeft = mapRange(p, 0, 1, 40, 60);          // drifts right slightly
  const sunSize = mapRange(p, 0, 1, 60, 100, ease);   // grows as it rises
  const sunGlow = mapRange(p, 0, 1, 0.3, 0.8);
  sunEl.style.top    = `${sunTop}%`;
  sunEl.style.left   = `${sunLeft}%`;
  sunEl.style.width  = `${sunSize}px`;
  sunEl.style.height = `${sunSize}px`;
  sunEl.style.opacity = mapRange(p, 0, 0.08, 0, 1);
  sunEl.style.boxShadow = `
    0 0 ${60+p*120}px ${20+p*60}px rgba(255,180,50,${sunGlow * 0.5}),
    0 0 ${200+p*300}px ${80+p*120}px rgba(255,130,0,${sunGlow * 0.2})
  `;
  sunFlare.style.opacity = mapRange(p, 0.3, 1, 0, 0.6);
  sunFlare.style.top     = `${sunTop - 15}%`;
  sunFlare.style.left    = `${sunLeft}%`;

  /* ════════════════════════════════════════════════
     PARALLAX — DEPTH LAYERS
     Each layer moves at a different speed to simulate
     distance from camera (depth / z-axis simulation).

     Speed multipliers (lower = further away = slower):
       sky          : 0   (fixed – infinite depth)
       mountains-far: 0.05
       hills-near   : 0.15
       dust         : 0.10
       road         : 0.30
       vehicle      : 1.0  (subject – reference)
       fg-foliage   : 1.6  (closest – fastest)
  ════════════════════════════════════════════════ */
  const scrollPx = p * (scrollRoot.scrollHeight - vh);

  // Mountains — slow lateral drift & vertical rise
  const mtX = mapRange(p, 0, 1, 0,  -vw * 0.08);
  const mtY = mapRange(p, 0, 1, 0,   vh * 0.06);
  mtFar.style.transform = `translate3d(${mtX}px, ${mtY}px, 0)`;

  // Hills — faster than mountains
  const hlX = mapRange(p, 0, 1, 0, -vw * 0.18);
  const hlY = mapRange(p, 0, 1, 0,  vh * 0.10);
  hillsNear.style.transform = `translate3d(${hlX}px, ${hlY}px, 0)`;

  // Dust — rises with speed (momentum illusion)
  const dustOpacity = mapRange(p, 0.15, 0.7, 0, 0.9, ease);
  const dustY = mapRange(p, 0, 1, 0, -vh * 0.06);
  dust.style.opacity = dustOpacity;
  dust.style.transform = `translateY(${dustY}px)`;

  /* ════════════════════════════════════════════════
     CAMERA MOVEMENT — scene-by-scene
     Prompt: each scene uses a distinct camera language.
  ════════════════════════════════════════════════ */

  // -- SCENE 0 (0–0.25): Pull-back + slight tilt up (establishing)
  // Camera starts tight and pulls wide; vehicle grows into frame.
  const s0 = mapRange(p, 0, 0.25, 0, 1, easeIO);
  const zoom0    = mapRange(s0, 0, 1, 1.18, 1.00);   // slow pull-back
  const panY0    = mapRange(s0, 0, 1,  60, 0);        // camera tilts level
  const panX0    = mapRange(s0, 0, 1, -40, 0);        // slight pan left→center

  // -- SCENE 1 (0.25–0.50): Lateral track (camera runs alongside)
  // Vehicle moves right, camera pans to follow.
  const s1 = mapRange(p, 0.25, 0.50, 0, 1, ease);
  const panX1    = mapRange(s1, 0, 1,   0, vw * 0.12); // pan right
  const panY1    = mapRange(s1, 0, 1,   0, -vh * 0.04);// slight elevation
  const zoom1    = mapRange(s1, 0, 1, 1.00, 1.05);     // subtle push-in

  // -- SCENE 2 (0.50–0.75): Low dolly push, nose-down tilt
  // Ground level approach — road converges, perspective deepens.
  const s2 = mapRange(p, 0.50, 0.75, 0, 1, ease);
  const zoom2    = mapRange(s2, 0, 1, 1.05, 1.22);     // push into vehicle
  const tilt2    = mapRange(s2, 0, 1, 0, 2.5);          // degrees nose-down
  const panY2    = mapRange(s2, 0, 1, -vh * 0.04, vh * 0.06);

  // -- SCENE 3 (0.75–1.00): Crane up + zoom out (hero/wide reveal)
  // Camera elevates above horizon line; vehicle silhouettes against sun.
  const s3 = mapRange(p, 0.75, 1.00, 0, 1, easeIO);
  const zoom3    = mapRange(s3, 0, 1, 1.22, 0.92);      // zoom out to epic wide
  const panY3    = mapRange(s3, 0, 1,  vh * 0.06, -vh * 0.08); // crane up

  /* Composite camera transform (blended by scene position) */
  let finalZoom = 1, finalPanX = 0, finalPanY = 0, finalTilt = 0;

  if (p <= 0.25) {
    finalZoom = zoom0;
    finalPanX = panX0;
    finalPanY = panY0;
  } else if (p <= 0.50) {
    finalZoom = zoom0 * zoom1;
    finalPanX = panX1;
    finalPanY = panY0 + panY1;
  } else if (p <= 0.75) {
    finalZoom = zoom1 * zoom2;
    finalPanX = panX1;
    finalPanY = panY1 + panY2;
    finalTilt = tilt2;
  } else {
    finalZoom = zoom2 * zoom3;
    finalPanX = lerp(panX1, 0, s3);
    finalPanY = panY2 + panY3;
    finalTilt = lerp(tilt2, 0, s3);
  }

  // Apply to scene root (camera mount)
  scene.style.transform = `
    translate3d(${finalPanX}px, ${finalPanY}px, 0)
    scale(${finalZoom})
    rotateX(${finalTilt}deg)
  `;
  scene.style.perspective = '800px';

  /* ════════════════════════════════════════════════
     VEHICLE — subject-layer animations
     Prompt: drift, motion blur, scale for depth
  ════════════════════════════════════════════════ */

  // Vehicle appears from right edge on scene 0
  const vehX0 = mapRange(p, 0, 0.12, vw * 0.3, 0, ease);
  // Lateral drift through scenes 1-2 (passes camera left)
  const vehX1 = mapRange(p, 0.25, 0.60, 0, -vw * 0.08);
  // Returns to center for hero shot
  const vehX2 = mapRange(p, 0.75, 1.0, -vw * 0.08, 0, ease);

  const vehY = mapRange(p, 0.50, 0.75, 0, -vh * 0.04, ease); // slight rise on push

  const vehScale = mapRange(p, 0.50, 0.75, 1.0, 1.12, ease); // grows on dolly push

  // Motion blur at high-speed segment
  const blurAmt = mapRange(p, 0.25, 0.55, 0, 4);
  const motionBlur = blurAmt > 0.5 ? `blur(${blurAmt.toFixed(1)}px)` : 'none';

  // Scene 3: silhouette + backlit effect
  const silhouette = p > 0.75 ? mapRange(p, 0.75, 1.0, 0, 1) : 0;
  const brightness = lerp(1.0, 0.45, silhouette);
  const contrast   = lerp(1.0, 1.30, silhouette);

  vehicleWrap.style.transform = `translate3d(${vehX0 + vehX1 + vehX2}px, ${vehY}px, 0) scale(${vehScale})`;
  vehicleSvg.style.filter = `${motionBlur} brightness(${brightness}) contrast(${contrast})`;

  // Headlight glow intensifies on approach (scene 2)
  const headlightGlow = mapRange(p, 0.50, 0.75, 0, 1, ease);
  const glowColor = `drop-shadow(0 0 ${12 + headlightGlow * 30}px rgba(255,250,200,${0.2 + headlightGlow * 0.6}))`;
  vehicleSvg.style.filter += ` ${glowColor}`;

  /* ════════════════════════════════════════════════
     FOREGROUND — fastest parallax layer
     Creates depth illusion as rocks/foliage rush past
  ════════════════════════════════════════════════ */
  const fgX = mapRange(p, 0, 1, 0, -vw * 0.40);
  const fgY = mapRange(p, 0, 1, 0,  vh * 0.05);
  fgFoliage.style.transform = `translate3d(${fgX}px, ${fgY}px, 0)`;

  /* ════════════════════════════════════════════════
     ROAD — perspective deepens with push-in
  ════════════════════════════════════════════════ */
  const roadScale = mapRange(p, 0.50, 0.75, 1.0, 1.08, ease);
  roadWrap.style.transform = `scaleY(${roadScale})`;
  roadWrap.style.transformOrigin = 'bottom center';

  /* ── Ground fg ────────────────────────────────── */
  groundFg.style.transform = `translateX(${mapRange(p, 0, 1, 0, -vw * 0.12)}px)`;
}

/* ── Scroll handler ─────────────────────────────── */
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      scrollPct = getScrollPct();
      updateScene(scrollPct);
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

/* ── Resize handler ─────────────────────────────── */
window.addEventListener('resize', () => {
  resizeGrainCanvas();
  updateScene(scrollPct);
});

/* ════════════════════════════════════════════════
   FILM GRAIN — procedural noise overlay
   Refreshes every frame for organic texture
════════════════════════════════════════════════ */
function resizeGrainCanvas() {
  grainCanvas.width  = window.innerWidth;
  grainCanvas.height = window.innerHeight;
}

function drawGrain() {
  const w = grainCanvas.width;
  const h = grainCanvas.height;
  if (w === 0 || h === 0) { requestAnimationFrame(drawGrain); return; }

  // Use small tile for performance, pattern fill
  const tileW = 256, tileH = 256;
  const imageData = grainCtx.createImageData(tileW, tileH);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = data[i+1] = data[i+2] = v;
    data[i+3] = 255;
  }
  // Draw tile across canvas
  const offscreen = new OffscreenCanvas(tileW, tileH);
  offscreen.getContext('2d').putImageData(imageData, 0, 0);
  grainCtx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y += tileH) {
    for (let x = 0; x < w; x += tileW) {
      grainCtx.drawImage(offscreen, x, y);
    }
  }
  requestAnimationFrame(drawGrain);
}

/* ════════════════════════════════════════════════
   WHEEL SPIN ANIMATION (SVG rotation)
   Prompt: confirm vehicle motion, realism cue
════════════════════════════════════════════════ */
let wheelAngle = 0;
const wheelEls = document.querySelectorAll(
  '#tractor circle[cx="1070"], #tractor circle[cx="720"], #tractor circle[cx="760"],' +
  '#trailer circle[cx="110"], #trailer circle[cx="155"], #trailer circle[cx="360"], #trailer circle[cx="405"]'
);

// Use SMIL animation for wheel spin on mid-ring circles
function animateWheels() {
  // Increase spin speed with scroll
  const speed = 1 + scrollPct * 6;
  wheelAngle = (wheelAngle + speed) % 360;

  // Apply rotation to inner detail rings (lug-nut ring)
  document.querySelectorAll('#tractor circle[r="37"], #trailer circle[r="34"]').forEach(c => {
    const cx = c.getAttribute('cx');
    const cy = c.getAttribute('cy');
    c.setAttribute('transform', `rotate(${wheelAngle}, ${cx}, ${cy})`);
  });

  // Dust cloud offset
  const dustCloud = document.getElementById('wheel-dust');
  if (dustCloud) {
    const dustOffset = Math.sin(Date.now() / 400) * 4;
    dustCloud.style.transform = `translateX(${-10 - scrollPct * 20}px) translateY(${dustOffset}px)`;
    dustCloud.style.opacity = String(0.15 + scrollPct * 0.4);
  }

  requestAnimationFrame(animateWheels);
}

/* ════════════════════════════════════════════════
   AUDIO — Web Audio API ambient engine sound
   Synthetic diesel rumble using oscillators
════════════════════════════════════════════════ */
let audioCtx = null;
let engineNodes = null;
let audioActive = false;

function buildEngineAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const master = audioCtx.createGain();
  master.gain.value = 0.12;
  master.connect(audioCtx.destination);

  // Low diesel thrum (fundamental ~70Hz)
  function makeOsc(freq, type, gain, detune = 0) {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(master);
    osc.start();
    return { osc, gain: g };
  }

  // Diesel harmonic stack
  const nodes = [
    makeOsc(44,  'sawtooth', 0.4),        // rumble fundamental
    makeOsc(88,  'sawtooth', 0.25,  5),   // octave
    makeOsc(132, 'square',   0.12, -3),   // 3rd harmonic (muffled)
    makeOsc(176, 'square',   0.07),       // 4th harmonic
  ];

  // LFO for engine pulse (mimics cylinder firing)
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 5.5;    // ~330 RPM idle equivalent
  lfoGain.gain.value  = 8;
  lfo.connect(lfoGain);
  nodes.forEach(n => lfoGain.connect(n.osc.frequency));
  lfo.start();

  // Bandpass filter to shape diesel timbre
  const bpf = audioCtx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 120;
  bpf.Q.value = 0.8;
  master.connect(bpf);

  engineNodes = { master, nodes, lfo, lfoGain };

  // Update engine pitch with scroll speed
  function updateEngineRPM() {
    if (!audioActive) return;
    const rpm = 1 + scrollPct * 2.5;
    nodes.forEach((n, i) => {
      n.osc.frequency.value = (44 * (i + 1)) * rpm;
    });
    lfo.frequency.value = 5.5 * rpm;
    requestAnimationFrame(updateEngineRPM);
  }
  updateEngineRPM();
}

document.getElementById('audio-btn').addEventListener('click', () => {
  if (!audioCtx) buildEngineAudio();

  if (audioActive) {
    engineNodes.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    audioActive = false;
    document.getElementById('audio-btn').textContent = '▶ AMBIENT';
  } else {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    engineNodes.master.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.5);
    audioActive = true;
    document.getElementById('audio-btn').textContent = '■ AMBIENT';
  }
});

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
resizeGrainCanvas();
drawGrain();
animateWheels();
updateScene(0);           // set initial state before any scroll
