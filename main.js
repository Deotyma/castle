import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

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
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

function createPage(front, back) {
  const geometry = new THREE.BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2
  );
  geometry.translate(PAGE_WIDTH / 2, 0, 0);

  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;
    const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
    const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
    skinIndices.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const bones = [];
  for (let i = 0; i <= PAGE_SEGMENTS; i++) {
    const bone = new THREE.Bone();
    bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
    if (i > 0) bones[i - 1].add(bone);
    bones.push(bone);
  }

  const skeleton = new THREE.Skeleton(bones);

  const loader = new THREE.TextureLoader();
  loader.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const frontMap = loader.load(front);
  const backMap = loader.load(back);

  frontMap.colorSpace = THREE.SRGBColorSpace;
  backMap.colorSpace = THREE.SRGBColorSpace;

  frontMap.minFilter = THREE.LinearFilter;
  backMap.minFilter = THREE.LinearFilter;

  const materials = [
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ color: '#111' }),
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ color: 'white' }),
    new THREE.MeshStandardMaterial({ map: frontMap, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: backMap, side: THREE.DoubleSide }),
  ];

  const mesh = new THREE.SkinnedMesh(geometry, materials);
  mesh.add(bones[0]);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return { mesh, bones };
}

const pagesData = [
  'Bedzin', 'Bobolice', 'Dankow', 'Korzkiew', 'Lipowiec',
  'Lutowiec', 'Mirow', 'Ogrodzieniec', 'Ojcow', 'Olsztyn',
  'Pieskowa_Skala', 'Pilca', 'Rabsztyn', 'Ryczow', 'Siewierz',
  'Smolen', 'Tenczyn'
];

let currentIndex = 0;
let leftPage, rightPage;
let rightBones;
let flipping = false;
let flipProgress = 0;

function loadPages(index) {
  if (leftPage) scene.remove(leftPage);
  if (rightPage) scene.remove(rightPage);

  if (pagesData[index]) {
    const { mesh } = createPage(
      `/descriptions/${pagesData[index]}.png`
    );
    mesh.rotation.y = 0;
    mesh.position.x = -PAGE_WIDTH / 2;
    leftPage = mesh;
    scene.add(mesh);
  }

  if (pagesData[index]) {
    const { mesh, bones } = createPage(
      `/photos/${pagesData[index]}.jpg`
    );
    mesh.position.x = PAGE_WIDTH / 2;
    rightPage = mesh;
    rightBones = bones;
    scene.add(mesh);
  } else {
    rightPage = null;
    rightBones = null;
  }
}

loadPages(currentIndex);

document.addEventListener('click', () => {
  if (flipping || currentIndex >= pagesData.length - 1) return;
  flipping = true;
  flipProgress = 0;
});

function animate() {
  requestAnimationFrame(animate);

  if (flipping && rightBones) {
    flipProgress += 0.015;
    const angle = -Math.PI * Math.sin((flipProgress * Math.PI) / 2);
    rightBones.forEach((bone) => {
      bone.rotation.y += (angle - bone.rotation.y) * 0.15;
    });

    if (flipProgress >= 1) {
      flipping = false;
      currentIndex++;
      loadPages(currentIndex);
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

