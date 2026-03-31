import * as THREE from 'https://esm.sh/three@0.158.0';
import { OrbitControls } from 'https://esm.sh/three@0.158.0/examples/jsm/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let atomicGroup = new THREE.Group();
let hybridGroup = new THREE.Group();
let nucleus;

// State tracking
let activeOrbitals = new Set(); // Stores 's', 'px', 'py', 'pz', 'dz2', 'dx2y2'
let currentHybridState = null; // 'sp', 'sp2', etc. if active
let isHybridized = false;

// --- Colors ---
const COLORS = {
    s: 0x4dabf7, // Light Blue
    p: 0xff6b6b, // Red/Pink
    d: 0x51cf66, // Green
    hybrid: 0xcc5de8 // Purple
};

// --- Initialization ---
function init() {
    const container = document.getElementById('canvas-container');
    const loadMsg = document.getElementById('loading');

    // Scene setup
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 5, 20);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('orbital-canvas'), antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
    backLight.position.set(-10, -20, -10);
    scene.add(backLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = false;

    // Grid / Axes
    const axesHelper = new THREE.AxesHelper( 2 ); 
    scene.add( axesHelper );

    // Nucleus
    const nucGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const nucMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    nucleus = new THREE.Mesh(nucGeo, nucMat);
    scene.add(nucleus);

    // Add Groups
    scene.add(atomicGroup);
    scene.add(hybridGroup);
    
    loadMsg.classList.remove('active');

    // UI Events
    setupUI();

    // Resize Event
    window.addEventListener('resize', onWindowResize);

    // Render loop
    animate();
}

// --- Orbital Construction Helpers ---
function createLobe(color, length = 3, width = 1) {
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.85,
        shininess: 100,
        specular: 0x333333
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(width, length/2, width);
    mesh.position.y = length/2; // Base at origin
    
    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    return wrapper;
}

function createSOrbital() {
    const geo = new THREE.SphereGeometry(1.5, 32, 32);
    const mat = new THREE.MeshPhongMaterial({ color: COLORS.s, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
}

// --- Draw Real-time Atomic Selection ---
function renderAtomicSelection() {
    // Clear out current atomic group without breaking animation
    while(atomicGroup.children.length > 0){ 
        atomicGroup.remove(atomicGroup.children[0]); 
    }

    if(activeOrbitals.has('s')){
        atomicGroup.add(createSOrbital());
    }
    
    if(activeOrbitals.has('px')){
        const px1 = createLobe(COLORS.p, 3, 1); px1.rotation.z = -Math.PI/2;
        const px2 = createLobe(COLORS.p, 3, 1); px2.rotation.z = Math.PI/2;
        atomicGroup.add(px1, px2);
    }
    if(activeOrbitals.has('py')){
        // Chemistry Y is Three.js Z (Horizontal)
        const py1 = createLobe(COLORS.p, 3, 1); py1.rotation.x = Math.PI/2; 
        const py2 = createLobe(COLORS.p, 3, 1); py2.rotation.x = -Math.PI/2;
        atomicGroup.add(py1, py2);
    }
    if(activeOrbitals.has('pz')){
        // Chemistry Z is Three.js Y (Vertical, aligned with dz2)
        const pz1 = createLobe(COLORS.p, 3, 1); 
        const pz2 = createLobe(COLORS.p, 3, 1); pz2.rotation.x = Math.PI;
        atomicGroup.add(pz1, pz2);
    }
    
    if(activeOrbitals.has('dz2')){
        const dz1 = createLobe(COLORS.d, 4.5, 0.9);
        const dz2 = createLobe(COLORS.d, 4.5, 0.9); dz2.rotation.x = Math.PI;
        // Make the torus (donut) much larger to wrap around the p orbitals
        const torusGeo = new THREE.TorusGeometry(2.2, 0.5, 16, 50);
        const torusMat = new THREE.MeshPhongMaterial({color: COLORS.d, transparent: true, opacity: 0.8});
        const ring = new THREE.Mesh(torusGeo, torusMat);
        ring.rotation.x = Math.PI/2; // Lie flat in XZ (equatorial) plane
        atomicGroup.add(dz1, dz2, ring);
    }
    
    if(activeOrbitals.has('dx2y2')){
        // dx2y2 lies in the chemistry XY plane (Three.js XZ plane)
        const dx1 = createLobe(COLORS.d, 4.5, 0.9); dx1.rotation.z = -Math.PI/2; // +X
        const dx2 = createLobe(COLORS.d, 4.5, 0.9); dx2.rotation.z = Math.PI/2;  // -X
        const dx3 = createLobe(COLORS.d, 4.5, 0.9); dx3.rotation.x = Math.PI/2;  // +Z
        const dx4 = createLobe(COLORS.d, 4.5, 0.9); dx4.rotation.x = -Math.PI/2; // -Z
        atomicGroup.add(dx1, dx2, dx3, dx4);
    }
    
    // Animate pop-in effect 
    atomicGroup.scale.set(0.9, 0.9, 0.9);
    gsap.to(atomicGroup.scale, { duration: 0.5, x: 1, y: 1, z: 1, ease: 'back.out(2)' });
}

// --- Build target Hybrid geometry ---
function buildHybridGeometry(type) {
    while(hybridGroup.children.length > 0){ 
        hybridGroup.remove(hybridGroup.children[0]); 
    }
    const len = 4;
    const wid = 1.3;

    if (type === 'sp') {
        const l1 = createLobe(COLORS.hybrid, len, wid); l1.rotation.z = Math.PI/2;
        const l2 = createLobe(COLORS.hybrid, len, wid); l2.rotation.z = -Math.PI/2;
        hybridGroup.add(l1, l2);
    } 
    else if (type === 'sp2') {
        for(let i=0; i<3; i++) {
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.z = i * (2 * Math.PI / 3);
            hybridGroup.add(l);
        }
    }
    else if (type === 'sp3') {
        const verts = [
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(-1, -1, 1),
            new THREE.Vector3(-1, 1, -1),
            new THREE.Vector3(1, -1, -1)
        ];
        verts.forEach(v => {
            const l = createLobe(COLORS.hybrid, len, wid);
            const dummy = new THREE.Object3D();
            dummy.lookAt(v);
            l.quaternion.copy(dummy.quaternion);
            l.rotateX(Math.PI/2);
            hybridGroup.add(l);
        });
    }
    else if (type === 'sp3d') {
        const l1 = createLobe(COLORS.hybrid, len, wid);
        const l2 = createLobe(COLORS.hybrid, len, wid); l2.rotation.x = Math.PI;
        hybridGroup.add(l1, l2);
        for(let i=0; i<3; i++){
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.z = Math.PI/2; 
            l.rotation.y = i * (2*Math.PI/3);
            hybridGroup.add(l);
        }
    }
    else if (type === 'sp3d2') {
        const axes = [
            [0,0,0], [Math.PI,0,0],       
            [Math.PI/2,0,0], [-Math.PI/2,0,0],
            [0,0,Math.PI/2], [0,0,-Math.PI/2] 
        ];
        axes.forEach(rot => {
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.set(rot[0], rot[1], rot[2]);
            hybridGroup.add(l);
        });
    }

    hybridGroup.scale.set(0, 0, 0); // Hide initially
}

// --- Logic & Detection ---
function checkHybridizationRule() {
    const hasS = activeOrbitals.has('s');
    const hasPx = activeOrbitals.has('px');
    const hasPy = activeOrbitals.has('py');
    const hasPz = activeOrbitals.has('pz');
    
    let pCount = 0;
    if(hasPx) pCount++;
    if(hasPy) pCount++;
    if(hasPz) pCount++;
    
    const hasDz2 = activeOrbitals.has('dz2');
    const hasDx2y2 = activeOrbitals.has('dx2y2');
    let dCount = (hasDz2?1:0) + (hasDx2y2?1:0);

    let matchedType = null;
    
    // Strict rules with precise chemistry directional requirements
    if (hasS && pCount === 1 && dCount === 0) {
        matchedType = 'sp';
    } else if (hasS && pCount === 2 && dCount === 0) {
        matchedType = 'sp2';
    } else if (hasS && pCount === 3 && dCount === 0) {
        matchedType = 'sp3';
    } else if (hasS && pCount === 3 && dCount === 1) {
        // Strict sp3d requires dz2, dx2-y2 is invalid for sp3d
        if (hasDz2) matchedType = 'sp3d';
    } else if (hasS && pCount === 3 && dCount === 2) {
        matchedType = 'sp3d2';
    }

    // Update UI Buttons
    document.querySelectorAll('.hybrid-btn').forEach(btn => {
        btn.classList.add('locked');
        btn.classList.remove('ready');
        btn.disabled = true;
        
        if(btn.dataset.type === matchedType) {
            btn.classList.remove('locked');
            btn.classList.add('ready');
            btn.disabled = false;
        }
    });

    currentHybridState = matchedType;
}

// --- Triggers ---
function triggerHybridizeAnim() {
    if(!currentHybridState) return;
    
    isHybridized = true;

    // Build the invisible target logic
    buildHybridGeometry(currentHybridState);
    
    // Directional alignment logic based on specific selected atomic orbitals
    hybridGroup.rotation.set(0, 0, 0); // Reset
    
    if (currentHybridState === 'sp') {
        // Base sp is along Three.js X-axis (Chemistry X)
        if (activeOrbitals.has('py')) {
            // align to Three.js Z (Chemistry Y)
            hybridGroup.rotation.y = Math.PI / 2; 
        } else if (activeOrbitals.has('pz')) {
            // align to Three.js Y (Chemistry Z)
            hybridGroup.rotation.z = Math.PI / 2; 
        }
    } else if (currentHybridState === 'sp2') {
        // Base sp2 is built in Three.js XY plane (Chemistry XZ plane) -> px + pz
        if (activeOrbitals.has('px') && activeOrbitals.has('py')) {
            // align to Three.js XZ plane (Chemistry XY)
            hybridGroup.rotation.x = Math.PI / 2; 
        } else if (activeOrbitals.has('py') && activeOrbitals.has('pz')) {
            // align to Three.js ZY plane (Chemistry YZ)
            hybridGroup.rotation.y = Math.PI / 2; 
        }
    }

    // 3 Second Animation 
    // Target atomic group shrinks
    gsap.to(atomicGroup.scale, {
        duration: 3,
        x: 0.1, y: 0.1, z: 0.1,
        ease: 'power3.inOut'
    });
    
    // Target atomic opacity fade
    // Wait... opacity requires iterating materials, scaling is often enough visually
    
    // Target hybrid group grows
    gsap.to(hybridGroup.scale, {
        duration: 3,
        x: 1, y: 1, z: 1,
        ease: 'elastic.out(1, 0.7)',
        delay: 0.5 // Start popping slightly after atomic starts shrinking
    });

    // Toggle UI buttons
    document.querySelectorAll('.atomic-btn').forEach(btn => btn.disabled = true);
    document.querySelectorAll('.hybrid-btn').forEach(btn => {
        btn.classList.add('locked');
        btn.classList.remove('ready');
        btn.disabled = true;
    });
    
    const resetBtn = document.getElementById('btn-reset');
    resetBtn.style.display = 'block';
    gsap.fromTo(resetBtn, {opacity: 0}, {opacity: 1, delay: 2});
}

function resetToAtomic() {
    isHybridized = false;
    
    // Animate out hybrid
    gsap.to(hybridGroup.scale, { duration: 0.5, x: 0, y: 0, z: 0, ease: 'power2.in' });
    
    // Animate in original
    gsap.to(atomicGroup.scale, { duration: 1, x: 1, y: 1, z: 1, ease: 'back.out(1)', delay: 0.5 });

    // Restore UI
    document.querySelectorAll('.atomic-btn').forEach(btn => btn.disabled = false);
    checkHybridizationRule();
    document.getElementById('btn-reset').style.display = 'none';
}

// --- Interaction Setup ---
function setupUI() {
    const atomicBtns = document.querySelectorAll('.atomic-btn');
    
    atomicBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if(isHybridized) return;

            const orb = btn.dataset.orb;
            if(activeOrbitals.has(orb)) {
                activeOrbitals.delete(orb);
                btn.classList.remove('active');
            } else {
                activeOrbitals.add(orb);
                btn.classList.add('active');
            }
            
            checkHybridizationRule();
            renderAtomicSelection();
        });
    });

    const hybridBtns = document.querySelectorAll('.hybrid-btn');
    hybridBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if(!btn.disabled && !isHybridized) {
                triggerHybridizeAnim();
            }
        });
    });

    document.getElementById('btn-reset').addEventListener('click', resetToAtomic);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize on load
window.onload = init;
