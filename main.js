import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 4, 2);
light.castShadow = true;
light.shadow.bias = -0.001;
light.shadow.mapSize.set(2048, 2048);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// Page parameters
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

// Bending parameters
const easingFactor = 0.5;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;

// Shared geometry with skinning
const pageGeometry = new THREE.BoxGeometry(
  PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2
);
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const posAttr = pageGeometry.attributes.position;
const skinIdx = [];
const skinWgh = [];
for (let i = 0; i < posAttr.count; i++) {
  const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
  const si = Math.floor(v.x / SEGMENT_WIDTH);
  const sw = (v.x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
  skinIdx.push(si, si + 1, 0, 0);
  skinWgh.push(1 - sw, sw, 0, 0);
}
pageGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
pageGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWgh, 4));

// Page creation helper
function createPage(frontURL, backURL) {
  const loader = new THREE.TextureLoader();
  const frontTex = loader.load(frontURL);
  const backTex = loader.load(backURL);
  frontTex.colorSpace = backTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.minFilter = backTex.minFilter = THREE.LinearFilter;

  const mats = [
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ color: '#111' }),
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ map: frontTex, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: backTex, side: THREE.DoubleSide }),
  ];

  const mesh = new THREE.SkinnedMesh(pageGeometry, mats);
  mesh.castShadow = mesh.receiveShadow = true;

  const bones = [];
  for (let i = 0; i <= PAGE_SEGMENTS; i++) {
    const bone = new THREE.Bone();
    bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
    if (i > 0) bones[i - 1].add(bone);
    bones.push(bone);
  }
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  return { mesh, bones };
}

const pages = [
  'Bedzin','Bobolice','Dankow','Korzkiew','Lipowiec',
  'Lutowiec','Mirow','Ogrodzieniec','Ojcow','Olsztyn',
  'Pieskowa_Skala','Pilca','Rabsztyn','Ryczow','Siewierz',
  'Smolen','Tenczyn'
];

let idx = 0;
let leftMesh, flipMesh, backMesh;
let flipBones;
let flipping = false;
let progress = 0;

function showSpread(i) {
  [leftMesh, flipMesh, backMesh].forEach(m => m && scene.remove(m));

  // Left: description left, castle right
  if (pages[i]) {
    const left = createPage(
      `/descriptions/${pages[i]}.png`,
      `/photos/${pages[i]}.jpg`
    );
    left.mesh.position.x = -PAGE_WIDTH;
    left.mesh.rotation.y = 0;
    leftMesh = left.mesh;
    scene.add(leftMesh);
  }

  // Flip: description of next on front, castle of same next on back
  if (pages[i + 1]) {
    const flip = createPage(
      `/photos/${pages[i + 1]}.jpg`,
      `/descriptions/${pages[i+1]}.png`
      
    );
    flip.mesh.position.x = 0;
    flipMesh = flip.mesh;
    flipBones = flip.bones;
    scene.add(flipMesh);
  }

  // Back: castle of next next behind
  if (pages[i+1]) {
    const back = createPage(
      `/photos/${pages[i ]}.jpg`,
      `/photos/${pages[i]}.jpg`,
      
      
    );
    back.mesh.position.x = PAGE_WIDTH;
    back.mesh.rotation.y = -Math.PI;
    backMesh = back.mesh;
    scene.add(backMesh);
  }
}

showSpread(idx);

document.addEventListener('click', () => {
  if (flipping || !flipBones) return;
  flipping = true;
  progress = 0;
});

function animate() {
  requestAnimationFrame(animate);
  if (flipping) {
    progress += 0.02;
    const t = Math.min(1, progress);
    const target = -Math.PI / 2;
    flipBones.forEach((b, j) => {
      const inside = j < 8 ? Math.sin(j * 0.2 + 0.25) : 0;
      const outside = j >= 8 ? Math.cos(j * 0.3 + 0.09) : 0;
      const turn = Math.sin(j * Math.PI / flipBones.length) * t;
      const angle =
        insideCurveStrength * inside * target -
        outsideCurveStrength * outside * target +
        turningCurveStrength * turn * target;
      b.rotation.y += (angle - b.rotation.y) * easingFactor;
    });
    if (progress >= 1) {
      flipping = false;
      idx++;
      showSpread(idx);
    }
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

