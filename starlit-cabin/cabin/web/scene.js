import * as THREE from './vendor/three.module.js';

const canvas=document.querySelector('#scene'), room=canvas.parentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x171a29,.028);
const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(8,7.6,11.5);
const target=new THREE.Vector3(0,1.1,0);camera.lookAt(target);
scene.add(new THREE.AmbientLight(0x9790d4,.8));
const moonlight=new THREE.DirectionalLight(0x9caeff,3);moonlight.position.set(-3,7,-3);scene.add(moonlight);
const warm=new THREE.PointLight(0xffc27b,42,16,2);warm.position.set(1,3.8,2);warm.castShadow=true;warm.shadow.mapSize.set(1024,1024);scene.add(warm);
const fill=new THREE.DirectionalLight(0xd9b3d5,1.1);fill.position.set(5,4,7);scene.add(fill);
const world=new THREE.Group();scene.add(world);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...extra});
const wood=mat(0x382b38),darkWood=mat(0x241d2b),gold=mat(0xb89352,{metalness:.65,roughness:.35}),wall=mat(0x29283c),purple=mat(0x443653),ivory=mat(0xcfc0a1);
function box(w,h,d,material,x,y,z,parent=world){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cylinder(rt,rb,h,material,x,y,z,parent=world){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,32),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function sphere(r,material,x,y,z,parent=world){const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),material);m.position.set(x,y,z);parent.add(m);return m;}
const objects=[];function hotspot(group,name){group.userData.action=name;objects.push(group);}
// Open-front miniature room, built from original geometry.
box(8,.35,6.4,wood,0,-.25,0);for(let i=0;i<16;i++)box(.46,.04,6.15,mat(i%2?0x423443:0x392e3b),-3.75+i*.5,-.05,0);
box(8,5,.18,wall,0,2.35,-3.1);box(.16,5,6.3,mat(0x252537),-4,2.35,0);
box(8,.15,.3,gold,0,.15,-2.95);box(.3,.15,6,gold,-3.85,.15,0);
for(let x=-3.6;x<4;x+=1.2)box(.06,4.9,.1,wood,x,2.4,-2.94);
// Arched window, a moon in deep blue glass and a velvet curtain.
const arch=new THREE.Shape();arch.moveTo(-.85,0);arch.lineTo(-.85,1.55);arch.absarc(0,1.55,.85,Math.PI,0,true);arch.lineTo(.85,0);arch.closePath();
const windowMesh=new THREE.Mesh(new THREE.ShapeGeometry(arch),new THREE.MeshBasicMaterial({color:0x172747}));windowMesh.position.set(.7,1.7,-2.97);world.add(windowMesh);
const curve=new THREE.EllipseCurve(0,0,.91,.91,0,Math.PI,false,0);const pts=curve.getPoints(40).map(p=>new THREE.Vector3(p.x+.7,p.y+3.25,-2.88));const archTrim=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.035,8,false),gold);world.add(archTrim);
box(.065,1.6,.08,gold,-.21,2.45,-2.87);box(.065,1.6,.08,gold,1.61,2.45,-2.87);box(1.9,.10,.28,gold,.7,1.65,-2.8);box(.035,2.2,.07,gold,.7,2.8,-2.85);box(1.8,.035,.07,gold,.7,2.95,-2.85);
const moon=sphere(.31,new THREE.MeshBasicMaterial({color:0xf8e4ba}),1.13,3.54,-2.91);sphere(.27,new THREE.MeshBasicMaterial({color:0x172747}),1.25,3.61,-2.84);
for(let i=0;i<18;i++){const x=-.06+(i*0.618%1)*1.5,y=1.9+(i*.381%1)*1.9;sphere(.009,new THREE.MeshBasicMaterial({color:0xb8c9ff}),x,y,-2.89);}
for(let i=0;i<7;i++){cylinder(.10,.14,2.95,mat(i%2?0x443047:0x50394f),-.61+i*.13,2.6,-2.63);cylinder(.1,.14,2.95,mat(i%2?0x443047:0x50394f),1.85+i*.13,2.6,-2.63);}
box(3.65,.09,.2,gold,.85,4.13,-2.65);
// Bookcase, each shelf is reachable by raycasting.
const books=new THREE.Group();books.position.set(-2.7,0,-2.5);world.add(books);hotspot(books,'books');
box(1.5,3.9,.5,darkWood,0,2,0,books);for(const y of [.25,1.15,2.05,2.95,3.9])box(1.65,.09,.7,wood,0,y,.1,books);
box(.11,3.7,.64,gold,-.79,2,.08,books);box(.11,3.7,.64,gold,.79,2,.08,books);
const colors=[0x705044,0x3e565c,0x68506b,0x8b7248,0x3c4056];
for(let row=0;row<4;row++)for(let i=0;i<7;i++){const h=.45+((i*3+row)%4)*.08,x=-.62+i*.2,y=.32+row*.9+h/2;const book=box(.14,h,.37,mat(colors[(i+row)%5]),x,y,.25,books);book.rotation.z=(i===5?.11:0);box(.145,.022,.015,gold,x,y+h*.3,.445,books);box(.145,.022,.015,gold,x,y-h*.3,.445,books);}
// Round velvet rug with concentric gilt borders.
cylinder(2.6,2.6,.018,mat(0x343049),.1,.01,.65);
for(const r of [2.42,2.48,2.13]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.016,6,90),gold);ring.rotation.x=-Math.PI/2;ring.position.set(.1,.035,.65);world.add(ring);}
// Altar table.
box(4.7,.21,2.5,wood,.25,1.25,.45);box(4.8,.05,2.6,gold,.25,1.35,.45);
for(const x of [-1.7,2.2])for(const z of [-.48,1.4]){cylinder(.10,.15,1.2,darkWood,x,.57,z);cylinder(.16,.16,.1,gold,x,.12,z);}
box(2.4,.025,2.63,purple,.35,1.395,.45);box(2.4,.7,.025,purple,.35,1.05,1.765);
for(const x of [-.8,1.49])box(.025,.026,2.65,gold,x,1.41,.45);
const sigil=new THREE.Mesh(new THREE.TorusGeometry(.77,.01,5,70),gold);sigil.rotation.x=-Math.PI/2;sigil.position.set(.35,1.417,.35);world.add(sigil);
// Crystal ball and ornate foot.
const crystal=new THREE.Group();crystal.position.set(.25,1.44,-.15);world.add(crystal);hotspot(crystal,'crystal');
cylinder(.32,.39,.11,gold,0,.05,0,crystal);cylinder(.20,.29,.19,gold,0,.16,0,crystal);
sphere(.46,new THREE.MeshPhysicalMaterial({color:0xbda1f4,metalness:.1,roughness:.12,transparent:true,opacity:.82,emissive:0x563284,emissiveIntensity:.7}),0,.59,0,crystal);
sphere(.13,new THREE.MeshBasicMaterial({color:0xefdcff,transparent:true,opacity:.45}),-.16,.77,.28,crystal);
const crystalLight=new THREE.PointLight(0xac7dff,8,4,2);crystalLight.position.set(.25,2.1,-.15);world.add(crystalLight);
// Physical deck and loose cards on the cloth.
const deck=new THREE.Group();deck.position.set(.30,1.46,1.12);deck.rotation.y=.1;world.add(deck);hotspot(deck,'deck');
for(let i=0;i<8;i++){box(.53,.023,.86,ivory,(i%2)*.009,i*.025,0,deck);}box(.54,.017,.87,mat(0x292941),0,.21,0,deck);
for(const x of [-.23,.23])box(.012,.012,.77,gold,x,.225,0,deck);for(const z of [-.38,.38])box(.47,.012,.012,gold,0,.225,z,deck);
const seal=new THREE.Mesh(new THREE.TorusGeometry(.125,.012,6,32),gold);seal.rotation.x=-Math.PI/2;seal.position.y=.232;deck.add(seal);
// Journal.
const journal=new THREE.Group();journal.position.set(-1.35,1.46,.4);journal.rotation.y=-.24;world.add(journal);hotspot(journal,'journal');
box(.75,.10,1.0,mat(0x62454c),0,0,0,journal);box(.66,.07,.92,ivory,.03,.015,0,journal);box(.76,.025,1.01,mat(0x62454c),0,.065,0,journal);box(.05,.03,1.01,gold,.18,.083,0,journal);box(.08,.035,.2,gold,.35,.075,0,journal);
// Candles with glowing flames.
const candles=new THREE.Group();world.add(candles);hotspot(candles,'candle');const flames=[];
for(const [x,z,h] of [[1.8,.0,.8],[1.55,-.3,1.1],[2.0,-.45,.65]]){cylinder(.15,.22,.08,gold,x,1.46,z,candles);cylinder(.07,.10,.25,gold,x,1.62,z,candles);cylinder(.12,.12,h,ivory,x,1.74+h/2,z,candles);const flame=sphere(.07,new THREE.MeshBasicMaterial({color:0xffd29a}),x,1.81+h,z,candles);flame.scale.y=2.1;flames.push(flame);const light=new THREE.PointLight(0xffad61,4,3,2);light.position.set(x,1.9+h,z);candles.add(light);}
// A small stool, brass telescope and hanging constellation mobile.
cylinder(.48,.48,.15,mat(0x504053),1.2,.72,2.55);for(const x of [.91,1.49])for(const z of [2.3,2.8])box(.09,.67,.09,wood,x,.34,z);
const plant=new THREE.Group();plant.position.set(-3.15,0,1.55);world.add(plant);cylinder(.3,.2,.55,mat(0x765641),0,.3,0,plant);
for(let i=0;i<8;i++){const leaf=sphere(.16,mat(0x56645e),Math.sin(i*2)*.25,.85+i*.045,Math.cos(i*2)*.25,plant);leaf.scale.set(.6,2.3,.35);leaf.rotation.z=Math.sin(i)*.6;}
const mobile=new THREE.Group();mobile.position.set(2.7,4,-1.7);world.add(mobile);for(let i=0;i<3;i++){const r=.2+i*.18;const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.012,5,60),gold);ring.rotation.y=i*.7;mobile.add(ring);}sphere(.08,gold,0,0,0,mobile);box(.008,.65,.008,gold,2.7,4.65,-1.7);
// Floating dust. Slow movement stops when the tab is hidden or reduced motion is requested.
const positions=new Float32Array(180);for(let i=0;i<60;i++){positions[i*3]=(Math.random()-.5)*7;positions[i*3+1]=.4+Math.random()*4;positions[i*3+2]=(Math.random()-.5)*5;}
const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xe7c99b,size:.018,transparent:true,opacity:.55}));world.add(dust);
// Soft halos identify useful objects, with a brighter pulse on the next step.
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(243,210,159,.55)');g.addColorStop(.3,'rgba(173,132,242,.20)');g.addColorStop(1,'rgba(133,97,220,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const glowMap=glowTexture();
const halos=[];
for(const [group,name,xyz,size] of [[crystal,'crystal',[0,.6,0],2.5],[deck,'deck',[0,.3,0],1.5],[books,'books',[0,2,.6],2.2],[journal,'journal',[0,.12,0],1.2]]){const material=new THREE.SpriteMaterial({map:glowMap,transparent:true,opacity:.23,depthWrite:false,blending:THREE.AdditiveBlending});const halo=new THREE.Sprite(material);halo.position.set(...xyz);halo.scale.set(size,size,1);group.add(halo);halos.push({halo,name});}
const deckLight=new THREE.PointLight(0xe5c38c,0,3,2);deckLight.position.set(.3,2,1.1);world.add(deckLight);
const bookLight=new THREE.PointLight(0xc6a4ef,3,4,2);bookLight.position.set(-2.6,2.5,-1.6);world.add(bookLight);
// A wider velvet tabletop receives the 78-card spread; it retracts after selection.
const spreadCloth=box(8,.022,7,mat(0x2d253e),.3,1.43,.4);spreadCloth.visible=false;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let mouseX=0,mouseY=0,view=document.body.dataset.stage||'home';
let transitionStart=performance.now(),duration=1100;
const fromPosition=camera.position.clone(),fromTarget=target.clone(),lookTarget=target.clone(),goalPosition=new THREE.Vector3(),goalTarget=new THREE.Vector3();
function goals(){const narrow=room.clientWidth<700;const ratio=room.clientWidth/room.clientHeight;
  if(view==='question'){goalPosition.set(narrow?1.1:1.7,narrow?3.6:3.2,narrow?5.6:4.5);goalTarget.set(.25,1.52,-.15);}
  else if(view==='ready'){goalPosition.set(narrow?3.2:4.4,5.3,narrow?7.4:7);goalTarget.set(.2,1.25,.4);}
  else if(view==='spread'){goalPosition.set(.3,ratio<1?12.6:8.9,1.5);goalTarget.set(.3,1.42,.4);}
  else if(view==='reveal'||view==='reading'){goalPosition.set(.4,narrow?7.3:6.5,narrow?4.7:4.2);goalTarget.set(.3,1.25,.35);}
  else{goalPosition.set(narrow?9.5:8,narrow?8.5:7.6,narrow?14:11.5);goalTarget.set(0,1.4,0);}
}
function move(next){view=next;duration=next==='spread'?580:next==='question'?1050:1100;transitionStart=performance.now();fromPosition.copy(camera.position);fromTarget.copy(lookTarget);goals();spreadCloth.visible=next==='spread';}
function hit(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(objects,true);if(!hits.length)return null;let o=hits[0].object;while(o&&!o.userData.action)o=o.parent;return o?.userData.action;}
canvas.addEventListener('pointermove',e=>{canvas.style.cursor=hit(e)?'pointer':'default';mouseX=(e.offsetX/canvas.clientWidth-.5)*.2;mouseY=(e.offsetY/canvas.clientHeight-.5)*.12;});
canvas.addEventListener('click',e=>{const action=hit(e);if(action)window.dispatchEvent(new CustomEvent('cabin-object',{detail:action}));});
window.addEventListener('cabin-view',e=>move(e.detail));
function resize(){const w=room.clientWidth,h=room.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();move(view);}
new ResizeObserver(resize).observe(room);resize();
renderer.setAnimationLoop(time=>{if(document.hidden)return;const t=time*.001;if(!reduced){dust.rotation.y=t*.012;mobile.rotation.y=t*.12;flames.forEach((f,i)=>f.scale.y=2.1+Math.sin(t*3+i)*.15);warm.intensity=42+Math.sin(t*2)*2;}
  const onTable=['spread','reveal','reading'].includes(view);
  const propSpeed=reduced?1:.075;
  deck.scale.lerp(new THREE.Vector3(onTable?.02:1,onTable?.02:1,onTable?.02:1),propSpeed);
  crystal.position.lerp(new THREE.Vector3(onTable?-.95:.25,1.44,onTable?-.62:-.15),propSpeed);
  const guideName=view==='home'||view==='question'?'crystal':view==='ready'?'deck':null;
  const pulse=reduced?.65:.65+Math.sin(t*2)*.2;
  for(const {halo,name} of halos)halo.material.opacity=name===guideName?pulse:.14;
  crystalLight.intensity=guideName==='crystal'?12+pulse*4:5;deckLight.intensity=guideName==='deck'?9+pulse*4:1.5;
  const progress=reduced?1:Math.min(1,(performance.now()-transitionStart)/duration);const ease=1-Math.pow(1-progress,3);
  camera.position.lerpVectors(fromPosition,goalPosition,ease);lookTarget.lerpVectors(fromTarget,goalTarget,ease);camera.lookAt(lookTarget);renderer.render(scene,camera);
  const marker=document.querySelector('#object-guide');if(guideName&&!marker.hidden){const p=new THREE.Vector3();(guideName==='crystal'?crystal:deck).getWorldPosition(p);p.y+=guideName==='crystal'?1.3:.6;p.project(camera);marker.style.left=`${Math.max(70,Math.min(room.clientWidth-70,(p.x*.5+.5)*room.clientWidth))}px`;marker.style.top=`${Math.max(160,Math.min(room.clientHeight-240,(-p.y*.5+.5)*room.clientHeight))}px`;}
});
