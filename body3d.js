/* ============================================================
   PULSE — body3d.js
   Three.js scene with editorial styling. Loads ./human_body.glb,
   places five hotspot spheres, projects HTML annotation pins.
   No HDR, no bloom, no Tron. Warm porcelain + sage edges.
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = './human_body.glb';

const HOTSPOTS = [
  { id: 'memory',    label: 'Cognitive',   yFrac: 0.92, xFrac: 0.00, zFrac: 0.18 },
  { id: 'breath',    label: 'Breath',      yFrac: 0.72, xFrac: 0.00, zFrac: 0.20 },
  { id: 'bmi',       label: 'Composition', yFrac: 0.55, xFrac: 0.00, zFrac: 0.18 },
  { id: 'reaction',  label: 'Reaction',    yFrac: 0.62, xFrac: -0.34, zFrac: 0.05 },
  { id: 'stillness', label: 'Stillness',   yFrac: 0.18, xFrac: 0.10, zFrac: 0.05 },
];

const PALETTE = {
  porcelain: 0xE9DFC8,
  porcelainSheen: 0xFAF4E8,
  ink: 0x14140F,
  sage: 0x3F5A4D,
  sage2: 0x5A7B6A,
  clay: 0xB05333,
  warmKey: 0xFFF1DC,
  coolFill: 0xC9D4D6,
};

/* ============================================================
   Wait for the page to be ready, then mount.
   ============================================================ */
const stage = document.getElementById('body3d');
const loadingEl = document.getElementById('body3d-loading');
const statusEl = document.getElementById('body3d-status');
const barEl = document.getElementById('body3d-bar');
const pctEl = document.getElementById('body3d-pct');
const pinsOverlay = document.getElementById('pins-overlay');

if (stage) start();

function start() {
  /* --------- Renderer --------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.classList.add('body3d__canvas');
  stage.appendChild(renderer.domElement);

  /* --------- Scene + camera --------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
  camera.position.set(0.6, 1.55, 3.4);

  /* --------- Lighting (3-point, no HDR) --------- */
  scene.add(new THREE.HemisphereLight(PALETTE.porcelainSheen, PALETTE.sage, 0.55));
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.18));
  const key = new THREE.DirectionalLight(PALETTE.warmKey, 1.15);
  key.position.set(3, 4.5, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(PALETTE.coolFill, 0.45);
  fill.position.set(-2.5, 1.5, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xFFD7B5, 0.5);
  rim.position.set(-1.5, 2.5, -3);
  scene.add(rim);

  /* --------- Controls --------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.6;
  controls.maxDistance = 6;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.82;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.35;
  controls.update();

  let userInteracted = false;
  ['pointerdown', 'wheel', 'touchstart'].forEach(ev =>
    renderer.domElement.addEventListener(ev, () => { userInteracted = true; controls.autoRotate = false; }, { passive: true })
  );

  /* --------- Default home camera (set after model loads) --------- */
  let home = { pos: camera.position.clone(), target: controls.target.clone() };

  /* --------- Hotspot spheres + pin pairing --------- */
  const hotspotGroup = new THREE.Group();
  scene.add(hotspotGroup);
  const hotspotMeshes = []; // { id, mesh, label, pinEl, worldPos, hover, active }

  function buildHotspots(modelBox) {
    const size = new THREE.Vector3();
    modelBox.getSize(size);
    const min = modelBox.min, max = modelBox.max;
    const height = size.y;

    HOTSPOTS.forEach(spec => {
      const pos = new THREE.Vector3(
        (min.x + max.x) / 2 + spec.xFrac * size.x,
        min.y + spec.yFrac * height,
        (min.z + max.z) / 2 + spec.zFrac * size.z,
      );

      const radius = Math.max(0.05, height * 0.045);
      const geom = new THREE.SphereGeometry(radius, 28, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE.sage,
        emissive: PALETTE.sage,
        emissiveIntensity: 0.4,
        roughness: 0.45,
        metalness: 0.1,
      });
      const sphere = new THREE.Mesh(geom, mat);
      sphere.position.copy(pos);
      sphere.userData = { id: spec.id, baseScale: 1, hover: false, active: false };
      hotspotGroup.add(sphere);

      // Subtle halo ring around each hotspot
      const ringGeom = new THREE.RingGeometry(radius * 1.6, radius * 1.7, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.sage,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(pos);
      ring.lookAt(camera.position);
      ring.userData = { isHalo: true, parentId: spec.id };
      hotspotGroup.add(ring);

      const pinEl = pinsOverlay.querySelector(`.pin3d[data-test="${spec.id}"]`);

      hotspotMeshes.push({
        id: spec.id,
        mesh: sphere,
        halo: ring,
        pinEl,
        worldPos: pos.clone(),
        hover: false,
        active: false,
      });
    });
  }

  function setActive(id) {
    hotspotMeshes.forEach(h => {
      h.active = (h.id === id);
      const c = h.active ? PALETTE.clay : PALETTE.sage;
      h.mesh.material.color.setHex(c);
      h.mesh.material.emissive.setHex(c);
      h.halo.material.color.setHex(c);
      h.pinEl?.classList.toggle('pin3d--active', h.active);
    });
  }

  // Expose so app.js can sync the highlighted hotspot when the user
  // navigates from the table-of-contents instead of clicking the model.
  window.body3d = { setActive };

  /* --------- Raycaster --------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredId = null;

  function updatePointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const targets = hotspotMeshes.map(h => h.mesh);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const id = hit?.object?.userData?.id ?? null;
    if (id !== hoveredId) {
      hoveredId = id;
      hotspotMeshes.forEach(h => { h.hover = (h.id === id); h.pinEl?.classList.toggle('pin3d--hover', h.hover); });
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    }
  });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const targets = hotspotMeshes.map(h => h.mesh);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (hit) {
      const id = hit.object.userData.id;
      setActive(id);
      window.loadTest?.(id);
    }
  });

  renderer.domElement.addEventListener('dblclick', () => {
    // Reset view
    smoothTo(home.pos, home.target);
  });

  function smoothTo(targetPos, targetLook, dur = 700) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const t0 = performance.now();
    function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, targetPos, e);
      controls.target.lerpVectors(startTarget, targetLook, e);
      controls.update();
      if (t < 1) requestAnimationFrame(step);
    }
    step();
  }

  /* --------- Materials applied to the loaded GLB --------- */
  function dressMaterials(root) {
    root.traverse(obj => {
      if (!obj.isMesh) return;
      const original = obj.material;
      obj.material = new THREE.MeshPhysicalMaterial({
        color: PALETTE.porcelain,
        roughness: 0.62,
        metalness: 0.04,
        sheen: 0.5,
        sheenRoughness: 0.85,
        sheenColor: new THREE.Color(PALETTE.porcelainSheen),
        clearcoat: 0.06,
        clearcoatRoughness: 0.4,
        emissive: 0x000000,
        envMapIntensity: 0.5,
      });
      obj.material.transparent = false;
      obj.castShadow = false;
      obj.receiveShadow = false;

      // Edges overlay — gives anatomical-plate feel
      const edges = new THREE.EdgesGeometry(obj.geometry, 28);
      const edgeMat = new THREE.LineBasicMaterial({
        color: PALETTE.ink,
        transparent: true,
        opacity: 0.16,
      });
      const lines = new THREE.LineSegments(edges, edgeMat);
      obj.add(lines);

      // Dispose old material to free GPU memory
      if (original?.dispose) original.dispose();
    });
  }

  /* --------- Load the model --------- */
  const loader = new GLTFLoader();
  let model = null;

  loader.load(
    MODEL_URL,
    (gltf) => {
      statusEl.textContent = 'Composing the plate…';
      model = gltf.scene;

      // Center + scale to ~2.0 units tall
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const desired = 2.1;
      const scale = desired / Math.max(size.y, 0.0001);
      model.scale.setScalar(scale);

      // Recenter so feet sit at y = 0
      box.setFromObject(model);
      const offset = new THREE.Vector3();
      box.getCenter(offset);
      model.position.x -= offset.x;
      model.position.z -= offset.z;
      model.position.y -= box.min.y;

      dressMaterials(model);
      scene.add(model);

      // Recompute box and place hotspots in world space
      const finalBox = new THREE.Box3().setFromObject(model);
      buildHotspots(finalBox);

      // Frame the camera
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);
      controls.target.set(0, finalSize.y * 0.55, 0);
      camera.position.set(finalSize.y * 0.35, finalSize.y * 0.7, finalSize.y * 1.55);
      controls.update();
      home = { pos: camera.position.clone(), target: controls.target.clone() };

      // Auto-rotate briefly after load to invite interaction
      controls.autoRotate = true;
      setTimeout(() => { if (!userInteracted) controls.autoRotate = false; }, 4500);

      // Fade out loading
      barEl.style.width = '100%';
      pctEl.textContent = '100%';
      setTimeout(() => { loadingEl.classList.add('body3d__loading--done'); }, 250);
    },
    (xhr) => {
      if (!xhr.lengthComputable) {
        statusEl.textContent = 'Streaming the figure…';
        return;
      }
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      barEl.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      statusEl.textContent = pct < 50 ? 'Reading the model…' : 'Almost there…';
    },
    (err) => {
      console.error('GLB load failed:', err);
      loadingEl.innerHTML = `
        <div class="body3d__error">
          <p class="body3d__error-title">Could not load the figure</p>
          <p class="body3d__error-detail">Drop <code>human_body.glb</code> next to <code>index.html</code>, then refresh. Everything else still works.</p>
        </div>
      `;
    },
  );

  /* --------- Projection: 3D hotspot → 2D pin --------- */
  const v3 = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  function updatePins() {
    if (!hotspotMeshes.length) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    camera.getWorldDirection(camDir);

    hotspotMeshes.forEach(h => {
      if (!h.pinEl) return;
      v3.copy(h.worldPos).project(camera);
      const x = (v3.x * 0.5 + 0.5) * w;
      const y = (-v3.y * 0.5 + 0.5) * h;

      // Visible if in front of camera
      const inFront = v3.z < 1;
      // Side hint — pin goes left if hotspot is left of center
      const side = (v3.x < 0) ? 'left' : 'right';
      h.pinEl.dataset.side = side;
      h.pinEl.style.transform = `translate(${side === 'left' ? '-100%' : '0'}, -50%)`;
      h.pinEl.style.left = x + 'px';
      h.pinEl.style.top  = y + 'px';
      h.pinEl.style.opacity = inFront ? '1' : '0';
      h.pinEl.style.pointerEvents = inFront ? 'auto' : 'none';

      // Hotspot pulse (idle / hover / active)
      const s = h.active ? 1.25 : (h.hover ? 1.18 : 1.0);
      h.mesh.scale.setScalar(s + Math.sin(performance.now() * 0.003 + h.id.length) * 0.04);
      h.mesh.material.emissiveIntensity = h.active ? 0.85 : (h.hover ? 0.7 : 0.45);

      // Keep halo facing the camera
      h.halo.lookAt(camera.position);
      h.halo.material.opacity = h.active ? 0.55 : (h.hover ? 0.45 : 0.28);
    });
  }

  // Allow pin clicks to also trigger the test
  pinsOverlay?.querySelectorAll('.pin3d').forEach(pin => {
    pin.addEventListener('click', () => {
      const id = pin.dataset.test;
      setActive(id);
      window.loadTest?.(id);
    });
  });

  /* --------- Resize --------- */
  function resize() {
    const rect = stage.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  /* --------- Render loop --------- */
  function tick() {
    requestAnimationFrame(tick);
    controls.update();
    updatePins();
    renderer.render(scene, camera);
  }
  tick();
}
