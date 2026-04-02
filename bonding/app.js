import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

let container, camera, scene, renderer;
let controls;
let mcPos, mcNeg, mcPzPos, mcPzNeg, mcSpIn, mcSpOut;
let nucleusA, nucleusB;

// UI Elements
const distanceSlider = document.getElementById('distance-slider');
const typeButtons = document.querySelectorAll('.orbital-btn[data-preset]');
const togglePyBtn = document.getElementById('toggle-py');
const togglePzSpBtn = document.getElementById('toggle-pz-sp');
const togglePzBtn = document.getElementById('toggle-pz');

// State
const state = {
    bondType: 'ss',
    distance: 0, // 0 to 100
    showPy: false, // Show py orbital flag for sp_sp
    showPzSp: false, // Show pz orbital flag for sp_sp
    showPz: false // Show pz orbital flag
};

// Colors
const POS_COLOR = 0xff2a5f; // Red/Pink
const NEG_COLOR = 0x00a8ff; // Blue
const CORE_COLOR = 0xffffff;
const SP_COLOR = 0x10b981; // Green for hybrids

init();
animate();

function init() {
    container = document.getElementById('webgl-container');

    // Scene setup
    scene = new THREE.Scene();
    
    // Camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // Pulled camera back to comfortably fit the fully separated orbitals on screen
    camera.position.set(0, 0, 10);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // Transparent background
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(2, 2, 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight2.position.set(-2, -2, 2);
    scene.add(dirLight2);

    // Materials
    const materialPos = new THREE.MeshPhysicalMaterial({
        color: POS_COLOR,
        metalness: 0.1,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });

    const materialNeg = new THREE.MeshPhysicalMaterial({
        color: NEG_COLOR,
        metalness: 0.1,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });

    const materialSp = new THREE.MeshPhysicalMaterial({
        color: SP_COLOR,
        metalness: 0.1,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });

    // Marching Cubes
    // Resolution defines the grid size. 80 is smooth and looks great.
    const resolution = 80;
    mcPos = new MarchingCubes(resolution, materialPos, true, true, 100000);
    mcPos.position.set(0, 0, 0);
    // Scale defines the world space bounds of the [0, 1] MarchingCubes volume.
    // scale = 4 means the box goes from -2 to +2 in X, Y, Z.
    mcPos.scale.set(4, 4, 4);
    scene.add(mcPos);

    mcNeg = new MarchingCubes(resolution, materialNeg, true, true, 100000);
    mcNeg.position.set(0, 0, 0);
    mcNeg.scale.set(4, 4, 4);
    scene.add(mcNeg);

    mcPzPos = new MarchingCubes(resolution, materialPos, true, true, 100000);
    mcPzPos.position.set(0, 0, 0);
    mcPzPos.scale.set(4, 4, 4);
    scene.add(mcPzPos);

    mcPzNeg = new MarchingCubes(resolution, materialNeg, true, true, 100000);
    mcPzNeg.position.set(0, 0, 0);
    mcPzNeg.scale.set(4, 4, 4);
    scene.add(mcPzNeg);

    mcSpIn = new MarchingCubes(resolution, materialSp, true, true, 100000);
    mcSpIn.position.set(0, 0, 0);
    mcSpIn.scale.set(4, 4, 4);
    scene.add(mcSpIn);

    mcSpOut = new MarchingCubes(resolution, materialSp, true, true, 100000);
    mcSpOut.position.set(0, 0, 0);
    mcSpOut.scale.set(4, 4, 4);
    scene.add(mcSpOut);

    // Nuclei (Small core spheres)
    const coreMat = new THREE.MeshStandardMaterial({ color: CORE_COLOR, emissive: 0x444444 });
    nucleusA = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 32), coreMat);
    nucleusB = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 32), coreMat);
    scene.add(nucleusA);
    scene.add(nucleusB);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);

    distanceSlider.addEventListener('input', (e) => {
        state.distance = parseFloat(e.target.value);
        updateScene();
    });

    typeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            typeButtons.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            state.bondType = target.getAttribute('data-preset');
            
            // 由於切換了主要按鍵，重置所有未混成軌域的顯示狀態
            state.showPy = false;
            state.showPzSp = false;
            state.showPz = false;
            if (togglePyBtn) togglePyBtn.classList.remove('active-toggle');
            if (togglePzSpBtn) togglePzSpBtn.classList.remove('active-toggle');
            if (togglePzBtn) togglePzBtn.classList.remove('active-toggle');
            
            updateSubButtonsUI();
            updateScene();
        });
    });

    if (togglePyBtn) {
        togglePyBtn.addEventListener('click', () => {
            if (state.bondType !== 'sp_sp') return;
            state.showPy = !state.showPy;
            togglePyBtn.classList.toggle('active-toggle', state.showPy);
            updateScene();
        });
    }

    if (togglePzSpBtn) {
        togglePzSpBtn.addEventListener('click', () => {
            if (state.bondType !== 'sp_sp') return;
            state.showPzSp = !state.showPzSp;
            togglePzSpBtn.classList.toggle('active-toggle', state.showPzSp);
            updateScene();
        });
    }

    if (togglePzBtn) {
        togglePzBtn.addEventListener('click', () => {
            if (state.bondType !== 'sp2_sp2') return;
            state.showPz = !state.showPz;
            togglePzBtn.classList.toggle('active-toggle', state.showPz);
            updateScene();
        });
    }

    function updateSubButtonsUI() {
        if (togglePzBtn) {
            const active = state.bondType === 'sp2_sp2';
            togglePzBtn.style.opacity = active ? '1' : '0.4';
            togglePzBtn.style.cursor = active ? 'pointer' : 'not-allowed';
        }
        const spActive = state.bondType === 'sp_sp';
        if (togglePyBtn) {
            togglePyBtn.style.opacity = spActive ? '1' : '0.4';
            togglePyBtn.style.cursor = spActive ? 'pointer' : 'not-allowed';
        }
        if (togglePzSpBtn) {
            togglePzSpBtn.style.opacity = spActive ? '1' : '0.4';
            togglePzSpBtn.style.cursor = spActive ? 'pointer' : 'not-allowed';
        }
    }

    // Initial Update
    updateSubButtonsUI();
    updateScene();
}

function onWindowResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Map world coordinates to MarchingCubes [0, 1] space.
function addPhaseLobe(mc, x, y, z, strength, subtract) {
    // scale is 4, and MarchingCubes domain is [-1, 1], so world domain is [-4, 4].
    // Mapped to [0, 1]: (X / 8) + 0.5
    const cx = (x / 8) + 0.5;
    const cy = (y / 8) + 0.5;
    const cz = (z / 8) + 0.5;
    
    // Bounds check to avoid rendering artifacts at edge of volume
    if (cx > 0.05 && cx < 0.95 && cy > 0.05 && cy < 0.95 && cz > 0.05 && cz < 0.95) {
        mc.addBall(cx, cy, cz, strength, subtract);
    }
}

// Helper to draw an elongated teardrop/petal shape in a generic 3D direction
function addPetalDir(mc, cX, cY, cZ, dx, dy, dz, pOff, str, sub) {
    // The user explicitly requested an "Ice Cream Cone" geometry:
    // A perfectly straight conical body that ends in a fitted spherical top.
    // To generate a straight Cone in Metaballs, the radius must grow linearly.
    // Since metaball radius is proportional to sqrt(strength), strength must grow QUADRATICALLY.
    
    const steps = 12; // Dense packing for a flawless straight cone surface
    const startOff = 0.2; // Start very close to the nucleus (cone tip)
    const endOff = 2.4;   // End at the center of the outer cap
    
    const R_start = 0.15; // Tiny radius at the tip
    const R_end = 1.0;    // Fat sphere for the ice-cream scoop top
    
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const currentOff = startOff + (endOff - startOff) * t;
        
        // Linear radius -> Quadratic strength
        const currentR = R_start + (R_end - R_start) * t;
        const currentStr = currentR * currentR; 
        
        addPhaseLobe(mc, cX + dx * pOff * currentOff, cY + dy * pOff * currentOff, cZ + dz * pOff * currentOff, str * currentStr, sub);
    }
    
    // Sharp negative carver to sever the absolute base exactly at the nucleus
    addPhaseLobe(mc, cX - dx * pOff * 0.1, cY - dy * pOff * 0.1, cZ - dz * pOff * 0.1, -str * 2.5, sub * 0.8);
}

function updateScene() {
    mcPos.reset();
    mcNeg.reset();
    mcPzPos.reset();
    mcPzNeg.reset();
    mcSpIn.reset();
    mcSpOut.reset();

    // Mapping distance 0 (far) to 100 (near)
    // At far distance = 0, atoms are pulled far apart with absolute zero interaction 
    // At near distance = 100, atoms are at ±0.20 for a deep merge
    const maxDist = 2.2;
    const minDist = 0.20;
    const currentDist = maxDist - (state.distance / 100) * (maxDist - minDist);

    const xA = -currentDist;
    const xB = currentDist;

    // Update nuclei positions
    nucleusA.position.set(xA, 0, 0);
    nucleusB.position.set(xB, 0, 0);

    // Metaballs config
    // Adjusting these changes the blob size and "stickiness"
    const strength = 0.15; 
    const subtract = 14; 
    const pOffset = 0.40; // The center of p-orbital lobes relative to the nucleus

    switch (state.bondType) {
        case 'ss':
            // Atom A: s-orbital (pos)
            addPhaseLobe(mcPos, xA, 0, 0, strength, subtract);
            // Atom B: s-orbital (pos)
            addPhaseLobe(mcPos, xB, 0, 0, strength, subtract);
            break;

        case 'sp':
            // Atom A: s-orbital (pos)
            addPhaseLobe(mcPos, xA, 0, 0, strength, subtract);
            // Atom B: p-orbital along X 
            addPetalDir(mcPos, xB, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Left (+)
            addPetalDir(mcNeg, xB, 0, 0, 1, 0, 0, pOffset, strength, subtract);  // Right (-)
            break;

        case 'pp_sigma':
            // Atom A: p-orbital along X (pos faces B)
            addPetalDir(mcNeg, xA, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Left (-)
            addPetalDir(mcPos, xA, 0, 0, 1, 0, 0, pOffset, strength, subtract);  // Right (+)
            // Atom B: p-orbital along X (pos faces A)
            addPetalDir(mcPos, xB, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Left (+)
            addPetalDir(mcNeg, xB, 0, 0, 1, 0, 0, pOffset, strength, subtract);  // Right (-)
            break;

        case 'pp_pi':
            // Atom A: p-orbital along Y (pos up, neg down)
            addPetalDir(mcPos, xA, 0, 0, 0, 1, 0, pOffset, strength, subtract);  // Top (+)
            addPetalDir(mcNeg, xA, 0, 0, 0, -1, 0, pOffset, strength, subtract); // Bottom (-)
            // Atom B: p-orbital along Y (pos up, neg down)
            addPetalDir(mcPos, xB, 0, 0, 0, 1, 0, pOffset, strength, subtract);  // Top (+)
            addPetalDir(mcNeg, xB, 0, 0, 0, -1, 0, pOffset, strength, subtract); // Bottom (-)
            break;

        case 'sp2_sp2': {
            const sq3_2 = Math.sqrt(3) / 2;

            // Atom A: sp2 hybrid trio
            addPetalDir(mcSpIn, xA, 0, 0, 1, 0, 0, pOffset, strength, subtract); // Bonding lobe
            addPetalDir(mcSpOut, xA, 0, 0, -0.5, sq3_2, 0, pOffset, strength, subtract); // Outer lobe 1
            addPetalDir(mcSpOut, xA, 0, 0, -0.5, -sq3_2, 0, pOffset, strength, subtract); // Outer lobe 2

            // Atom B: sp2 hybrid trio
            addPetalDir(mcSpIn, xB, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Bonding lobe
            addPetalDir(mcSpOut, xB, 0, 0, 0.5, sq3_2, 0, pOffset, strength, subtract);  // Outer lobe 1
            addPetalDir(mcSpOut, xB, 0, 0, 0.5, -sq3_2, 0, pOffset, strength, subtract);  // Outer lobe 2

            // Unhybridized pz orbitals if toggled (forming one pi bond)
            if (state.showPz) {
                const pStrength = strength * 1.6; 
                addPetalDir(mcPzPos, xA, 0, 0, 0, 0, 1, pOffset, pStrength, subtract);   // Atom A Front (+)
                addPetalDir(mcPzNeg, xA, 0, 0, 0, 0, -1, pOffset, pStrength, subtract);  // Atom A Back (-)
                addPetalDir(mcPzPos, xB, 0, 0, 0, 0, 1, pOffset, pStrength, subtract);   // Atom B Front (+)
                addPetalDir(mcPzNeg, xB, 0, 0, 0, 0, -1, pOffset, pStrength, subtract);  // Atom B Back (-)
            }
            break;
        }

        case 'sp_sp':
            // Atom A: sp hybrid pair drawn as elongated teardrop petals
            addPetalDir(mcSpIn, xA, 0, 0, 1, 0, 0, pOffset, strength, subtract);  // Right petal (faces inside)
            addPetalDir(mcSpOut, xA, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Left petal (faces outside)

            // Atom B: sp hybrid pair drawn as elongated teardrop petals
            addPetalDir(mcSpIn, xB, 0, 0, -1, 0, 0, pOffset, strength, subtract); // Left petal (faces inside)
            addPetalDir(mcSpOut, xB, 0, 0, 1, 0, 0, pOffset, strength, subtract);  // Right petal (faces outside)

            // Extra p orbitals if toggled (forming two pi bonds: py and pz)
            const pStrengthSp = strength * 1.6; 
            
            if (state.showPy) {
                // py orbitals (up/down) -> uses mcPos / mcNeg
                addPetalDir(mcPos, xA, 0, 0, 0, 1, 0, pOffset, pStrengthSp, subtract);   // Atom A Top (+)
                addPetalDir(mcNeg, xA, 0, 0, 0, -1, 0, pOffset, pStrengthSp, subtract);  // Atom A Bottom (-)
                addPetalDir(mcPos, xB, 0, 0, 0, 1, 0, pOffset, pStrengthSp, subtract);   // Atom B Top (+)
                addPetalDir(mcNeg, xB, 0, 0, 0, -1, 0, pOffset, pStrengthSp, subtract);  // Atom B Bottom (-)
            }
            
            if (state.showPzSp) {
                // pz orbitals (front/back) -> uses mcPzPos / mcPzNeg to NOT self-hybridize with py!
                addPetalDir(mcPzPos, xA, 0, 0, 0, 0, 1, pOffset, pStrengthSp, subtract);   // Atom A Front (+)
                addPetalDir(mcPzNeg, xA, 0, 0, 0, 0, -1, pOffset, pStrengthSp, subtract);  // Atom A Back (-)
                addPetalDir(mcPzPos, xB, 0, 0, 0, 0, 1, pOffset, pStrengthSp, subtract);   // Atom B Front (+)
                addPetalDir(mcPzNeg, xB, 0, 0, 0, 0, -1, pOffset, pStrengthSp, subtract);  // Atom B Back (-)
            }
            break;
    }

    mcPos.update();
    mcNeg.update();
    mcPzPos.update();
    mcPzNeg.update();
    mcSpIn.update();
    mcSpOut.update();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
