/* ============================================================
   SOMA — body3d.js
   The body is a canvas. Five GLSL effects paint test results
   directly onto the model surface in world space.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';

// ----------------------------------------------------------------
//  GLSL: vertex additions
// ----------------------------------------------------------------
const VERT_PARS  = `varying vec3 vWP;`;   // world position passed to frag
const VERT_MAIN  = `vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`;

// ----------------------------------------------------------------
//  GLSL: fragment shader additions
//  World-space effects — no UV dependency, works on any GLB.
// ----------------------------------------------------------------
const FRAG_PARS = `
varying vec3 vWP;

uniform float uT;           // time
uniform float uMinY;        // model world-space foot Y
uniform float uH;           // model world-space height

/* activation targets — 0 idle → 1 full */
uniform float uMemory;      // 0-1, neural density
uniform float uBreath;      // 0-1, oscillates with breath phase
uniform float uBMI;         // -1..+1  (neg=under, 0=typical, pos=over)
uniform float uBMISet;      // 0/1 boolean — BMI has been entered
uniform float uReaction;    // 0-1, arc speed (1=fastest)
uniform float uStill;       // 0-1, crystal growth fraction

/* region anchor positions (set after model loads) */
uniform vec3 uPH;  // head
uniform vec3 uPC;  // chest
uniform vec3 uPA;  // abdomen
uniform vec3 uPR;  // reaction arm
uniform vec3 uPL;  // leg

/* ---- hash ---- */
float h11(float n){ return fract(sin(n)*43758.5453); }
float h13(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
vec3  h33(vec3 p){
  return fract(sin(vec3(
    dot(p,vec3(127.1,311.7,74.7)),
    dot(p,vec3(269.5,183.3,246.1)),
    dot(p,vec3(113.5,271.9,124.6))
  ))*43758.5453);
}

/* ======================================================
   01. COGNITIVE — bioluminescent Voronoi node field
   Neural constellation grows denser with score.
   ====================================================== */
vec3 fxMemory(){
  float R = uH*0.20;
  float d = length(vWP-uPH);
  if(d>R || uMemory<0.005) return vec3(0.0);

  // Animated Voronoi (27-cell 3D lookup)
  vec3 gv  = vWP * (5.0 + uMemory*4.0);
  vec3 gi  = floor(gv);
  vec3 lv  = fract(gv);
  float mD = 1e9;
  for(int i=-1;i<=1;i++)
    for(int j=-1;j<=1;j++)
      for(int k=-1;k<=1;k++){
        vec3 nb  = vec3(float(i),float(j),float(k));
        vec3 rp  = h33(gi+nb);
        rp += 0.14*sin(uT*0.55+rp*6.28);  // slow drift
        mD = min(mD, length(lv-nb-rp));
      }

  float node  = smoothstep(0.07, 0.0, mD);
  float fade  = smoothstep(R, R*0.18, d);
  float pulse = 0.75 + 0.25*sin(uT*1.2 + h13(floor(vWP*6.0))*6.28);
  return vec3(0.25,0.85,1.0) * node * fade * pulse * uMemory * 3.2;
}

/* ======================================================
   02. BREATH — pulsing concentric wave spheres
   Phase is driven live by the breath pacer.
   ====================================================== */
vec3 fxBreath(){
  float R = uH*0.26;
  float d = length(vWP-uPC);
  if(d>R) return vec3(0.0);

  float wave = sin(d*9.0 - uT*3.8)*0.5+0.5;
  wave *= uBreath;
  float fade = smoothstep(R, R*0.12, d);
  // Warm gradient: core amber → outer rose
  vec3 col = mix(vec3(1.0,0.55,0.18), vec3(1.0,0.28,0.35), d/R);
  return col * wave * fade * 2.0;
}

/* ======================================================
   03. BMI — horizontal chromatic band
   Colour encodes under/typical/over/obese.
   ====================================================== */
vec3 fxBMI(){
  float R = uH*0.24;
  float d = length(vWP-uPA);
  if(d>R || uBMISet<0.5) return vec3(0.0);

  float yN   = (vWP.y-uMinY)/uH;
  float bmiY = 0.41+clamp(uBMI,-1.0,1.0)*0.072;
  float band = smoothstep(0.032, 0.0, abs(yN-bmiY));

  float t = uBMI*0.5+0.5;   // 0-1
  vec3 col = t<0.33 ? mix(vec3(0.18,0.42,1.0), vec3(0.1,0.88,0.45), t*3.0)
           : t<0.66 ? mix(vec3(0.1,0.88,0.45), vec3(1.0,0.78,0.14), (t-0.33)*3.0)
                    : mix(vec3(1.0,0.78,0.14), vec3(1.0,0.22,0.14), (t-0.66)*3.0);

  // Slow breathing pulse on band
  float pulse = 0.7+0.3*sin(uT*1.5);
  float fade  = smoothstep(R, R*0.28, d);
  return col * band * fade * pulse * 2.8;
}

/* ======================================================
   04. REACTION — stochastic lightning arc
   Brighter / faster arc inversely proportional to ms.
   ====================================================== */
vec3 fxReaction(){
  float R      = uH*0.30;
  float d      = length(vWP-uPR);
  if(d>R || uReaction<0.005) return vec3(0.0);

  float len  = uH*0.36;
  float armT = clamp((vWP.y-(uPR.y-len*0.5))/len, 0.0, 1.0);

  // Stepped random displacement along arm axis
  float spd   = 4.0+uReaction*10.0;
  float noiseX = (h11(floor(armT*20.0)+uT*spd      )-0.5)*0.055;
  float noiseZ = (h11(floor(armT*20.0)+uT*spd+100.0)-0.5)*0.048;

  float arcD = length(vec2(vWP.x-uPR.x-noiseX, vWP.z-uPR.z-noiseZ));
  float arc  = smoothstep(0.020, 0.0, arcD);
  // Travelling energy front
  arc *= smoothstep(0.0, 0.35, sin(armT*8.0 - uT*(8.0+uReaction*14.0)));

  float fade = smoothstep(R, R*0.38, d);
  vec3 col   = mix(vec3(0.4,0.75,1.0), vec3(0.9,0.97,1.0), arc);
  return col * arc * fade * uReaction * 3.8;
}

/* ======================================================
   05. STILLNESS — crystalline growth from feet
   Growth height tracks elapsed hold fraction.
   ====================================================== */
vec3 fxStill(){
  float R = uH*0.36;
  float d = length(vWP-uPL);
  if(d>R || uStill<0.005) return vec3(0.0);

  float yAbs  = vWP.y - uMinY;
  float thresh = uStill*uH*0.44;
  float grown = smoothstep(thresh+0.05, thresh-0.02, yAbs);

  // Discontinuous crystal cells
  float cn = h13(floor(vWP*5.5));
  float crystal = step(0.40, cn) * grown;
  // Shimmer
  crystal *= 0.65+0.35*sin(uT*1.9+cn*6.28);

  float fade = smoothstep(R, R*0.22, d);
  vec3 col = mix(vec3(0.55,0.88,1.0), vec3(0.85,0.96,1.0), cn);
  return col * crystal * fade * 2.2;
}

/* ---- always-on ambient (body is never fully dark) ---- */
vec3 fxAmbient(){
  float d = length(vWP-uPC);
  float p = sin(uT*0.85)*0.010+0.010;
  return vec3(0.06,0.18,0.10)*p*smoothstep(uH*0.55, 0.0, d);
}
`;

const FRAG_MAIN = `
// SOMA: write all effects additively onto the lit surface
vec3 soma = fxMemory() + fxBreath() + fxBMI() + fxReaction() + fxStill() + fxAmbient();
gl_FragColor.rgb += soma;
`;

// ----------------------------------------------------------------
//  Region descriptors
// ----------------------------------------------------------------
const REGIONS = [
  { id: 'memory',    yFrac: 0.92, xFrac:  0.00, zFrac: 0.14, camDA: 0.00, camElev:  0.46, camR: 1.20 },
  { id: 'breath',    yFrac: 0.70, xFrac:  0.00, zFrac: 0.18, camDA: 0.00, camElev:  0.36, camR: 1.40 },
  { id: 'bmi',       yFrac: 0.52, xFrac:  0.00, zFrac: 0.15, camDA:-0.28, camElev:  0.26, camR: 1.40 },
  { id: 'reaction',  yFrac: 0.60, xFrac: -0.30, zFrac: 0.04, camDA: 1.40, camElev:  0.30, camR: 1.35 },
  { id: 'stillness', yFrac: 0.18, xFrac:  0.12, zFrac: 0.02, camDA: 0.55, camElev: -0.12, camR: 1.55 },
];

// ----------------------------------------------------------------
//  Runtime
// ----------------------------------------------------------------
const viewport    = document.getElementById('viewport');
const loaderEl    = document.getElementById('loader');
const loaderMsg   = document.getElementById('loader-msg');
const loaderFill  = document.getElementById('loader-fill');
const loaderPct   = document.getElementById('loader-pct');
const pinsEl      = document.getElementById('pins');

if (viewport) boot();

function boot() {
  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping      = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.setClearColor(0x000000, 0);
  viewport.appendChild(renderer.domElement);

  // ---- Scene ----
  const scene  = new THREE.Scene();
  const clock  = new THREE.Clock();

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  camera.position.set(0, 1.4, 3.8);

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.14));
  scene.add(new THREE.HemisphereLight(0x9BBCCD, 0x0A1510, 0.55));

  const key = new THREE.DirectionalLight(0xE0F0FF, 1.1);
  key.position.set(2.5, 5, 3); scene.add(key);

  const fill = new THREE.DirectionalLight(0x204030, 0.55);
  fill.position.set(-2, 2, 2); scene.add(fill);

  const rim = new THREE.DirectionalLight(0x0A2030, 0.6);
  rim.position.set(-1.5, 3, -4); scene.add(rim);

  // ---- Controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, 0);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.07;
  controls.minDistance     = 1.2;
  controls.maxDistance     = 7;
  controls.minPolarAngle   = Math.PI * 0.12;
  controls.maxPolarAngle   = Math.PI * 0.88;
  controls.enablePan       = false;
  controls.autoRotate      = false;
  controls.autoRotateSpeed = 0.3;
  controls.update();

  const HOME_POS    = camera.position.clone();
  const HOME_TARGET = controls.target.clone();

  let touched = false;
  ['pointerdown','wheel','touchstart'].forEach(ev =>
    renderer.domElement.addEventListener(ev, () => { touched = true; controls.autoRotate = false; }, { passive: true })
  );
  renderer.domElement.addEventListener('dblclick', () => flyTo(null)); // reset

  // ---- Particles (ambient dust field) ----
  const PART = 2200;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PART * 3);
  for (let i = 0; i < PART * 3; i++) pPos[i] = (Math.random() - 0.5) * 3.6;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.012,
    color: 0x204860,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---- Shader uniforms ----
  const ufs = {
    uT:       { value: 0 },
    uMinY:    { value: 0 },
    uH:       { value: 2 },
    uMemory:  { value: 0 },
    uBreath:  { value: 0 },
    uBMI:     { value: 0 },
    uBMISet:  { value: 0 },
    uReaction:{ value: 0 },
    uStill:   { value: 0 },
    uPH: { value: new THREE.Vector3(0, 1.84, 0.12) },
    uPC: { value: new THREE.Vector3(0, 1.42, 0.18) },
    uPA: { value: new THREE.Vector3(0, 1.06, 0.15) },
    uPR: { value: new THREE.Vector3(-0.52, 1.20, 0.04) },
    uPL: { value: new THREE.Vector3(0.14, 0.36, 0.02) },
  };

  // Smooth approach: each effect has a current + target value
  const targets = {
    memory: 0, breath: 0, bmi: 0, bmiSet: 0, reaction: 0, still: 0,
  };

  // ---- Custom Shader Material (onBeforeCompile) ----
  let shaderRef = null;
  function makeMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color:    0x1E2820,
      roughness: 0.68,
      metalness: 0.05,
    });
    mat.onBeforeCompile = (sh) => {
      shaderRef = sh;
      Object.assign(sh.uniforms, ufs);

      // Vertex: export world position
      sh.vertexShader = VERT_PARS + '\n' + sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>\n${VERT_MAIN}`
      );

      // Fragment: add effect declarations + colour injection
      sh.fragmentShader = FRAG_PARS + '\n' + sh.fragmentShader;
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <tonemapping_fragment>',
        `${FRAG_MAIN}\n#include <tonemapping_fragment>`
      );
    };
    mat.needsUpdate = true;
    return mat;
  }

  // ---- Load Model ----
  const loader = new GLTFLoader();
  let modelBox = null;
  const regionWorld = {}; // id → THREE.Vector3

  loader.load(
    './human_body.glb',
    (gltf) => {
      const model = gltf.scene;

      // Scale to ~2.0 units tall, feet at y = 0
      const box  = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const scale = 2.0 / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);
      box.setFromObject(model);
      const ctr = new THREE.Vector3(); box.getCenter(ctr);
      model.position.sub(ctr);
      model.position.y -= box.min.y;

      // Apply custom material + edge overlay to every mesh
      const finalBox = new THREE.Box3().setFromObject(model);
      const finalMin = finalBox.min.clone();
      const finalH   = finalBox.max.y - finalBox.min.y;

      model.traverse(obj => {
        if (!obj.isMesh) return;
        const prev = obj.material;
        obj.material = makeMaterial();
        if (prev?.dispose) prev.dispose();

        // Subtle edge wireframe (anatomical-plate feel)
        const edges  = new THREE.EdgesGeometry(obj.geometry, 32);
        const eMat   = new THREE.LineBasicMaterial({ color: 0x1A3040, transparent: true, opacity: 0.22 });
        obj.add(new THREE.LineSegments(edges, eMat));
      });
      scene.add(model);

      // Set world-space uniforms from actual model bounds
      ufs.uMinY.value = finalMin.y;
      ufs.uH.value    = finalH;
      modelBox = finalBox;

      REGIONS.forEach(r => {
        const wp = new THREE.Vector3(
          (finalBox.min.x + finalBox.max.x) / 2 + r.xFrac * (finalBox.max.x - finalBox.min.x),
          finalMin.y + r.yFrac * finalH,
          (finalBox.min.z + finalBox.max.z) / 2 + r.zFrac * (finalBox.max.z - finalBox.min.z),
        );
        regionWorld[r.id] = wp;
      });

      // Set region position uniforms
      if (regionWorld.memory)    ufs.uPH.value.copy(regionWorld.memory);
      if (regionWorld.breath)    ufs.uPC.value.copy(regionWorld.breath);
      if (regionWorld.bmi)       ufs.uPA.value.copy(regionWorld.bmi);
      if (regionWorld.reaction)  ufs.uPR.value.copy(regionWorld.reaction);
      if (regionWorld.stillness) ufs.uPL.value.copy(regionWorld.stillness);

      // Camera home
      controls.target.set(0, finalH * 0.52, 0);
      camera.position.set(0, finalH * 0.6, finalH * 1.8);
      controls.update();
      HOME_POS.copy(camera.position);
      HOME_TARGET.copy(controls.target);

      // Brief auto-rotate to invite interaction
      controls.autoRotate = true;
      setTimeout(() => { if (!touched) controls.autoRotate = false; }, 5000);

      // Hotspot spheres
      buildHotspots(finalBox, finalH);

      // Fade out loader
      loaderFill.style.width = '100%';
      loaderPct.textContent  = '100 %';
      setTimeout(() => loaderEl.classList.add('hidden'), 400);

      // Show pins
      setTimeout(() => {
        document.querySelectorAll('.pin').forEach(p => { p.style.opacity = '1'; });
      }, 900);
    },
    (xhr) => {
      if (!xhr.lengthComputable) { loaderMsg.textContent = 'Streaming figure…'; return; }
      const p = Math.round(xhr.loaded / xhr.total * 100);
      loaderFill.style.width = p + '%';
      loaderPct.textContent  = p + ' %';
      loaderMsg.textContent  = p < 50 ? 'Reading model…' : 'Almost there…';
    },
    (err) => {
      console.error(err);
      loaderEl.innerHTML = `
        <div style="text-align:center;padding:32px;max-width:36ch;">
          <p style="font-family:var(--serif);font-size:22px;color:var(--ember);margin-bottom:12px;">Figure not found</p>
          <p style="color:var(--ink2);font-size:13px;line-height:1.6;">Place <code style="font-family:var(--mono);background:var(--surface2);padding:1px 6px;border-radius:3px;">human_body.glb</code> next to <code style="font-family:var(--mono);background:var(--surface2);padding:1px 6px;border-radius:3px;">index.html</code> and refresh. The panel tests still work.</p>
        </div>`;
    },
  );

  // ---- Hotspot spheres ----
  const hotspotMeshes = [];
  function buildHotspots(box, h) {
    REGIONS.forEach(r => {
      const pos = regionWorld[r.id];
      const rad = Math.max(0.045, h * 0.038);
      const geo = new THREE.SphereGeometry(rad, 28, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00CFFF, emissive: 0x004455, emissiveIntensity: 0.8,
        roughness: 0.4, metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData.id = r.id;
      scene.add(mesh);

      // Outer halo ring
      const rGeo = new THREE.RingGeometry(rad * 1.65, rad * 1.75, 48);
      const rMat = new THREE.MeshBasicMaterial({ color: 0x00CFFF, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.copy(pos);
      scene.add(ring);

      const pinEl = pinsEl?.querySelector(`.pin[data-test="${r.id}"]`);
      hotspotMeshes.push({ id: r.id, mesh, ring, pinEl, active: false, hover: false });
    });
  }

  // ---- Raycaster ----
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();

  function ptrFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    ptr.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointermove', e => {
    if (!hotspotMeshes.length) return;
    ptrFromEvent(e);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(hotspotMeshes.map(h => h.mesh), false)[0];
    const id  = hit?.object?.userData?.id ?? null;
    hotspotMeshes.forEach(h => {
      h.hover = (h.id === id);
      h.pinEl?.classList.toggle('hover', h.hover);
    });
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  });

  renderer.domElement.addEventListener('pointerdown', e => {
    ptrFromEvent(e);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(hotspotMeshes.map(h => h.mesh), false)[0];
    if (hit) {
      const id = hit.object.userData.id;
      setActive(id);
      window.loadTest?.(id);
    }
  });

  // Allow HTML pins to also trigger
  document.querySelectorAll('.pin').forEach(p => {
    p.addEventListener('click', () => {
      setActive(p.dataset.test);
      window.loadTest?.(p.dataset.test);
    });
  });

  function setActive(id) {
    hotspotMeshes.forEach(h => {
      h.active = h.id === id;
      h.mesh.material.color.setHex(h.active ? 0x00E87A : 0x00CFFF);
      h.mesh.material.emissive.setHex(h.active ? 0x003822 : 0x004455);
      h.pinEl?.classList.toggle('active', h.active);
    });
    flyTo(id);
  }

  // ---- Camera fly-to ----
  let flyRAF = null;
  function flyTo(id) {
    const r = REGIONS.find(x => x.id === id);
    const targetLook = r && regionWorld[r.id]
      ? regionWorld[r.id].clone()
      : HOME_TARGET.clone();
    const mH   = modelBox ? (modelBox.max.y - modelBox.min.y) : 2;
    const camR  = r ? r.camR * mH : HOME_POS.length();
    const theta = r ? (Math.PI * 0.5 + r.camDA) : 0;
    const phi   = r ? (Math.PI * 0.5 - r.camElev * Math.PI) : (Math.PI * 0.5 - 0.35);
    const targetCamPos = new THREE.Vector3(
      targetLook.x + camR * Math.sin(phi) * Math.sin(theta),
      targetLook.y + camR * Math.cos(phi),
      targetLook.z + camR * Math.sin(phi) * Math.cos(theta),
    );

    if (flyRAF) cancelAnimationFrame(flyRAF);
    const t0      = performance.now();
    const dur     = 900;
    const startP  = camera.position.clone();
    const startT  = controls.target.clone();

    function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      camera.position.lerpVectors(startP, targetCamPos, e);
      controls.target.lerpVectors(startT, targetLook, e);
      controls.update();
      if (t < 1) flyRAF = requestAnimationFrame(step);
    }
    step();
  }

  // ---- Pin projection ----
  const _v3 = new THREE.Vector3();
  function updatePins() {
    if (!pinsEl || !hotspotMeshes.length) return;
    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    hotspotMeshes.forEach(h => {
      if (!h.pinEl) return;
      _v3.copy(h.mesh.position).project(camera);
      const inFront = _v3.z < 1;
      const sx = (_v3.x * 0.5 + 0.5) * W;
      const sy = (-_v3.y * 0.5 + 0.5) * H;

      const side = _v3.x < 0 ? 'left' : 'right';
      const ox   = side === 'left' ? -12 : 12;
      h.pinEl.style.left      = `${sx + ox}px`;
      h.pinEl.style.top       = `${sy}px`;
      h.pinEl.style.transform = side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)';
      h.pinEl.style.visibility = inFront ? 'visible' : 'hidden';

      // Hotspot pulse
      const t   = performance.now() * 0.001;
      const s   = h.active ? 1.22 : h.hover ? 1.14 : 1.0;
      const sca = s + Math.sin(t * 2.4 + h.id.length * 0.7) * 0.04;
      h.mesh.scale.setScalar(sca);
      h.mesh.material.emissiveIntensity = h.active ? 1.2 : h.hover ? 0.9 : 0.6;

      // Halo ring faces camera
      h.ring.lookAt(camera.position);
      h.ring.material.opacity = h.active ? 0.6 : h.hover ? 0.45 : 0.22;
    });
  }

  // ---- Smooth uniform animation ----
  function lerpUniforms(dt) {
    const k = Math.min(1, dt * 3.5);
    if (!shaderRef) return;
    const u = shaderRef.uniforms;
    u.uMemory.value   += (targets.memory  - u.uMemory.value)   * k;
    u.uBreath.value   += (targets.breath  - u.uBreath.value)   * k;
    u.uBMI.value      += (targets.bmi     - u.uBMI.value)      * k;
    u.uBMISet.value   += (targets.bmiSet  - u.uBMISet.value)   * k;
    u.uReaction.value += (targets.reaction- u.uReaction.value)  * k;
    u.uStill.value    += (targets.still   - u.uStill.value)     * k;
    u.uT.value = clock.getElapsedTime();
  }

  // ---- Particle drift ----
  function driftParticles(dt) {
    const pos = pGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i  ] += (Math.sin(Date.now() * 0.00008 + i) * 0.0006);
      pos[i+1] += 0.00025;
      pos[i+2] += (Math.cos(Date.now() * 0.00007 + i) * 0.0004);
      // wrap
      if (pos[i+1] > 1.8) pos[i+1] = -1.8;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  // ---- Resize ----
  const ro = new ResizeObserver(() => {
    const W = viewport.clientWidth, H = viewport.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / Math.max(H, 1);
    camera.updateProjectionMatrix();
  });
  ro.observe(viewport);

  // ---- Render loop ----
  function tick() {
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    controls.update();
    driftParticles(dt);
    lerpUniforms(dt);
    updatePins();
    renderer.render(scene, camera);
  }
  tick();

  // ---- Public API ----
  window.soma = {
    setActive,

    setResult(id, data) {
      switch (id) {
        case 'memory':
          targets.memory = Math.min(1, (data.level ?? 1) / 8);
          break;
        case 'breath':
          // Called repeatedly with phase (0-1) during the exercise
          targets.breath = data.phase ?? 1;
          break;
        case 'bmi':
          // data.normalized: -1 (under) .. 0 (typical) .. +1 (over)
          targets.bmi    = data.normalized ?? 0;
          targets.bmiSet = 1;
          break;
        case 'reaction':
          targets.reaction = data.normalized ?? 0.5;
          break;
        case 'stillness':
          targets.still = data.fraction ?? 0;
          break;
      }
    },

    clearActive() {
      hotspotMeshes.forEach(h => {
        h.active = false;
        h.mesh.material.color.setHex(0x00CFFF);
        h.mesh.material.emissive.setHex(0x004455);
        h.pinEl?.classList.remove('active');
      });
      flyTo(null);
    },
  };
}
