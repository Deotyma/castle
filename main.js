import * as THREE from 'three';

// Renderer & scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 1.5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(2, 4, 2);
dirLight.castShadow = true;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040));

// Page config
const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

// Bend params
const easingFactor = 0.5;
const insideCurve = 0.18;
const outsideCurve = 0.05;
const turnStrength = 0.09;

// Shared geometry and skin attributes
const pageGeo = new THREE.BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2);
pageGeo.translate(PAGE_WIDTH / 2, 0, 0);
{
  const pos = pageGeo.attributes.position;
  const idxArr = [];
  const wArr = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const si = Math.floor(v.x / SEGMENT_WIDTH);
    const sw = (v.x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
    idxArr.push(si, si+1, 0,0);
    wArr.push(1-sw, sw,0,0);
  }
  pageGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idxArr,4));
  pageGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wArr,4));
}

// Create skinned page mesh
function makePage(front, back) {
  const loader = new THREE.TextureLoader();
  const ftx = loader.load(front);
  const btx = loader.load(back);
  ftx.colorSpace = btx.colorSpace = THREE.SRGBColorSpace;
  ftx.minFilter = btx.minFilter = THREE.LinearFilter;
  const mats = [
    new THREE.MeshStandardMaterial({color:'white',shininess: 150, roughness:0.7, metalness:0.5}),
    new THREE.MeshStandardMaterial({color:'#111', shininess: 150, roughness:0.7, metalness:0.5}),
    new THREE.MeshStandardMaterial({color:'white',shininess: 150, roughness:0.7, metalness:0.5}),
    new THREE.MeshStandardMaterial({color:'white', shininess: 150, roughness:0.7, metalness:0.5}),
    new THREE.MeshStandardMaterial({map:ftx, side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({map:btx, side:THREE.DoubleSide}),
  ];
  const mesh = new THREE.SkinnedMesh(pageGeo, mats);
  mesh.castShadow = mesh.receiveShadow = true;
  const bones=[];
  for(let i=0;i<=PAGE_SEGMENTS;i++){
    const b=new THREE.Bone();
    b.position.x = i===0?0:SEGMENT_WIDTH;
    if(i>0) bones[i-1].add(b);
    bones.push(b);
  }
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  return {mesh, bones};
}

// Pages list
const pages=['Bedzin','Bobolice','Dankow','Korzkiew','Lipowiec','Lutowiec','Mirow','Ogrodzieniec','Ojcow','Olsztyn','Pieskowa_Skala','Pilca','Rabsztyn','Ryczow','Siewierz','Smolen','Tenczyn'];

// State
let idx=0;
let leftMesh=null, rightMesh=null, flipMesh=null, flipBones=null;
let flipping=false, progress=0;

// Display two pages: left & right
function showSpread(i){
  [leftMesh,rightMesh].forEach(m=>m&&scene.remove(m));
  // left description/photo
  if(pages[i]){
    const {mesh:left} = makePage(`/descriptions/${pages[i]}.png`,`/photos/${pages[i]}.jpg`);
    left.position.x=-PAGE_WIDTH; scene.add(left); leftMesh=left;
  }
  // right current photo
  if(pages[i]){
    const {mesh:right} = makePage(`/photos/${pages[i]}.jpg`,`/description/${pages[i]}.png`);
    right.position.x=0; scene.add(right); rightMesh=right;
  }
}
showSpread(idx);

document.addEventListener('click',()=>{
  if(flipping||!pages[idx+1]) return;
  // create flip mesh above right
  const {mesh:fm, bones} = makePage(`/photos/${pages[idx+1]}.jpg`,`/descriptions/${pages[idx+1]}.png`);
  fm.position.x=0; scene.add(fm); flipMesh=fm; flipBones=bones;
  flipping=true; progress=0;
});

function animate(){
  requestAnimationFrame(animate);
  if(flipping&&flipBones){
    progress=Math.min(1, progress+0.02);
    const targ=-Math.PI/2;
    flipBones.forEach((b,j)=>{
      const inside=j<8?Math.sin(j*0.2+0.25):0;
      const outside=j>=8?Math.cos(j*0.3+0.09):0;
      const turn=Math.sin(j/flipBones.length*Math.PI)*progress;
      const ang=insideCurve*inside*targ - outsideCurve*outside*targ + turnStrength*turn*targ;
      b.rotation.y += (ang - b.rotation.y)*easingFactor;
    });
    if(progress>=1){
      // finish flip
      flipping=false;
      idx++;
      // remove flip mesh, then refresh spread
      scene.remove(flipMesh);
      flipMesh=null; flipBones=null;
      showSpread(idx);
    }
  }
  renderer.render(scene,camera);
}
animate();

// Responsive
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
