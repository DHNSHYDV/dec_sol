// Basic Three.js Scene Setup for Featherlite Prototype

const container = document.getElementById('canvas-container');

if (container) {
    // Scene
    const scene = new THREE.Scene();
    // Fog for depth (Charcoal fade)
    scene.fog = new THREE.FogExp2(0x0f0f11, 0.02); // Match bg color

    // Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5); // Start closer

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Limit pixel ratio to 2 for performance on high-DPI devices
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x22d3ee, 1, 100);
    pointLight.position.set(-2, 3, 4);
    scene.add(pointLight);

    // --- Model Management ---
    const models = {
        sneaker: { clean: null, loaded: false }
    };

    const manager = new THREE.LoadingManager();
    manager.onLoad = () => window.dispatchEvent(new Event('modelsLoaded'));
    const loader = new THREE.GLTFLoader(manager);

    // Helper to setup transparency
    const getTargetScale = () => window.innerWidth < 768 ? 0.6 : 1.1;

    const setupModel = (model, startVisible, startOpacity) => {
        const scale = getTargetScale();
        model.scale.set(scale, scale, scale);
        model.position.set(0, -0.8, 0);
        model.visible = startVisible;

        model.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = startOpacity;
                child.material.needsUpdate = true;
            }
        });
        scene.add(model);
    };

    // Load Clean Sneaker only
    loader.load('/static/models/shoe_clean.glb', (gltf) => {
        models.sneaker.clean = gltf.scene;
        setupModel(models.sneaker.clean, true, 1);
        models.sneaker.loaded = true;
    });

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        if (models.sneaker.clean) {
            models.sneaker.clean.rotation.y = time * 0.2;
        }

        renderer.render(scene, camera);
    }

    animate();

    // Resizing
    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        const newScale = getTargetScale();
        if (models.sneaker.clean) {
            models.sneaker.clean.scale.set(newScale, newScale, newScale);
        }
    });

    // Simplified logic for compatibility if any old scripts call these
    window.enterExperienceMode = () => { };
    window.exitExperienceMode3D = () => { };
    window.switchExperienceCategory = () => { };
    window.updateShoeDissolve = () => { };
} else {
    console.warn("Canvas container not found. 3D scene initialization skipped.");
}
