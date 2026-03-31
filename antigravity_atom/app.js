import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let currentGroup = new THREE.Group();
let atomicGroup = new THREE.Group();
let mixState = 'atomic'; // 'atomic' or 'hybrid'
let currentType = 'sp'; // Selected hybrid type (sp, sp2, sp3, sp3d, sp3d2)

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
    camera.position.set(0, 0, 15);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('orbital-canvas'), antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-10, -20, -10);
    scene.add(backLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.enablePan = false;

    // Grid / Axes (Optional for better spatial understanding)
    const axesHelper = new THREE.AxesHelper( 2 ); // X: red, Y: green, Z: blue
    scene.add( axesHelper );

    scene.add(currentGroup);
    
    // Initial Render
    buildOrbitals(currentType, mixState);
    loadMsg.classList.remove('active');

    // UI Events
    setupUI();

    // Resize Event
    window.addEventListener('resize', onWindowResize);

    // Render loop
    animate();
}

// --- Orbital Construction Helpers ---
function createLobe(color, length = 2, width = 1) {
    // A lobe is basically a stretched sphere displaced from the origin
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.85,
        shininess: 100,
        specular: 0x222222
    });
    const mesh = new THREE.Mesh(geo, mat);
    
    // Morph it into a teardrop/lobe
    mesh.scale.set(width, length/2, width);
    mesh.position.y = length/2; // Base at origin
    
    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    return wrapper;
}

function createSOrbital() {
    const geo = new THREE.SphereGeometry(1.5, 32, 32);
    const mat = new THREE.MeshPhongMaterial({ color: COLORS.s, transparent: true, opacity: 0.8 });
    return new THREE.Mesh(geo, mat);
}

// --- Build Orbital Geometries ---
function buildOrbitals(type, state) {
    // Clear current
    while(currentGroup.children.length > 0){ 
        currentGroup.remove(currentGroup.children[0]); 
    }

    if (state === 'atomic') {
        buildAtomic(type);
    } else {
        buildHybrid(type);
    }
}

// Pre-hybridization state (Separated atomic orbitals)
function buildAtomic(type) {
    const spacing = 4;
    
    // Always an S orbital
    const sNode = createSOrbital();
    sNode.position.x = -spacing;
    currentGroup.add(sNode);

    // Number of p orbitals
    let pCount = 0;
    let dCount = 0;

    if (type === 'sp') pCount = 1;
    else if (type === 'sp2') pCount = 2;
    else if (type === 'sp3') pCount = 3;
    else if (type === 'sp3d') { pCount = 3; dCount = 1; }
    else if (type === 'sp3d2') { pCount = 3; dCount = 2; }

    const pGroup = new THREE.Group();
    pGroup.position.x = (dCount > 0) ? 0 : spacing;
    
    // Px
    if (pCount >= 1) {
        const px1 = createLobe(COLORS.p, 3, 1); px1.rotation.z = -Math.PI/2;
        const px2 = createLobe(COLORS.p, 3, 1); px2.rotation.z = Math.PI/2;
        pGroup.add(px1, px2);
    }
    // Py
    if (pCount >= 2) {
        const py1 = createLobe(COLORS.p, 3, 1); 
        const py2 = createLobe(COLORS.p, 3, 1); py2.rotation.x = Math.PI;
        pGroup.add(py1, py2);
    }
    // Pz
    if (pCount >= 3) {
        const pz1 = createLobe(COLORS.p, 3, 1); pz1.rotation.x = Math.PI/2;
        const pz2 = createLobe(COLORS.p, 3, 1); pz2.rotation.x = -Math.PI/2;
        pGroup.add(pz1, pz2);
    }

    currentGroup.add(pGroup);

    // D orbitals
    if (dCount > 0) {
        const dGroup = new THREE.Group();
        dGroup.position.x = spacing;

        // dz2 (simplified as two vertical lobes + central ring)
        if (dCount >= 1) {
            const dz1 = createLobe(COLORS.d, 3, 1);
            const dz2 = createLobe(COLORS.d, 3, 1); dz2.rotation.x = Math.PI;
            
            const torusGeo = new THREE.TorusGeometry(1.2, 0.4, 16, 50);
            const torusMat = new THREE.MeshPhongMaterial({color: COLORS.d, transparent: true, opacity: 0.8});
            const ring = new THREE.Mesh(torusGeo, torusMat);
            ring.rotation.x = Math.PI/2;
            
            dGroup.add(dz1, dz2, ring);
        }

        // dx2-y2 (simplified as 4 lobes in xy plane)
        if (dCount >= 2) {
            // Shift second d orbital slightly or combine cleverly. We will just render it rotated.
            for(let i=0; i<4; i++){
                const dx = createLobe(COLORS.d, 3, 0.8);
                dx.rotation.z = i * Math.PI/2;
                // slightly offset to not overlap with dz2 perfectly visually
                dx.rotation.x = Math.PI/4; 
                dGroup.add(dx);
            }
        }
        currentGroup.add(dGroup);
    }

    // Enter animation
    currentGroup.scale.set(0,0,0);
    gsap.to(currentGroup.scale, { duration: 1, x: 1, y: 1, z: 1, ease: 'back.out(1.7)' });
}

// Post-hybridization state
function buildHybrid(type) {
    const lobes = [];
    const len = 3.5;
    const wid = 1.2;

    if (type === 'sp') {
        const l1 = createLobe(COLORS.hybrid, len, wid); l1.rotation.z = Math.PI/2;
        const l2 = createLobe(COLORS.hybrid, len, wid); l2.rotation.z = -Math.PI/2;
        lobes.push(l1, l2);
    } 
    else if (type === 'sp2') {
        for(let i=0; i<3; i++) {
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.z = i * (2 * Math.PI / 3);
            lobes.push(l);
        }
    }
    else if (type === 'sp3') {
        // Tetrahedral angles ~ 109.5
        const angles = [
            [0, 0, 0], // Setup later with lookAt
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        // Vertices of tetrahedron
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
            l.rotateX(Math.PI/2); // Align lobe (y-up axis originally)
            lobes.push(l);
        });
    }
    else if (type === 'sp3d') {
        // Trigonal bipyramidal
        // Axial
        const l1 = createLobe(COLORS.hybrid, len, wid);
        const l2 = createLobe(COLORS.hybrid, len, wid); l2.rotation.x = Math.PI;
        lobes.push(l1, l2);
        // Equatorial
        for(let i=0; i<3; i++){
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.z = Math.PI/2; // into XY plane
            l.rotation.y = i * (2*Math.PI/3);
            lobes.push(l);
        }
    }
    else if (type === 'sp3d2') {
        // Octahedral
        const axes = [
            [0,0,0], [Math.PI,0,0],        // +/- y
            [Math.PI/2,0,0], [-Math.PI/2,0,0], // +/- z
            [0,0,Math.PI/2], [0,0,-Math.PI/2]  // +/- x
        ];
        axes.forEach(rot => {
            const l = createLobe(COLORS.hybrid, len, wid);
            l.rotation.set(rot[0], rot[1], rot[2]);
            lobes.push(l);
        });
    }

    lobes.forEach(l => currentGroup.add(l));
    
    // Small generic enter animation
    currentGroup.scale.set(0.1, 0.1, 0.1);
    gsap.to(currentGroup.scale, { duration: 1.5, x: 1, y: 1, z: 1, ease: 'elastic.out(1, 0.5)' });
}

// --- Interaction UI Integration ---
function setupUI() {
    const btns = document.querySelectorAll('.hybrid-btn');
    const btnAtomic = document.getElementById('btn-show-atomic');
    const btnHybridize = document.getElementById('btn-hybridize');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentType = btn.dataset.type;
            buildOrbitals(currentType, mixState);
        });
    });

    btnAtomic.addEventListener('click', () => {
        mixState = 'atomic';
        buildOrbitals(currentType, mixState);
    });

    btnHybridize.addEventListener('click', () => {
        mixState = 'hybrid';
        // Fun transition sequence: scale down atomic -> morph -> pop out hybrid
        gsap.to(currentGroup.scale, {
            duration: 0.5,
            x: 0, y: 0, z: 0,
            ease: 'power2.in',
            onComplete: () => {
                buildOrbitals(currentType, mixState);
            }
        });
    });
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // only required if controls.enableDamping or controls.autoRotate are set
    renderer.render(scene, camera);
}

// Initialize on load
window.onload = init;
