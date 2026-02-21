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
        sneaker: { dirty: null, clean: null, loaded: false },
        curtain: { dirty: null, clean: null, loaded: false },
        carpet: { dirty: null, clean: null, loaded: false }
    };
    let activeCategory = 'sneaker';

    const manager = new THREE.LoadingManager();
    manager.onLoad = () => window.dispatchEvent(new Event('modelsLoaded'));
    const loader = new THREE.GLTFLoader(manager);

    // Helper to setup transparency
    const getTargetScale = () => window.innerWidth < 768 ? 0.6 : 1.1;

    const setupModel = (model, startVisible, startOpacity, isClean) => {
        const scale = getTargetScale();
        model.scale.set(scale, scale, scale);
        model.position.set(0, -0.8, 0);
        model.visible = startVisible;
        // Clean models render on top with a tiny z-offset to prevent z-fighting
        if (isClean) {
            model.renderOrder = 1;
            model.position.z = 0.001;
        }
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = startOpacity;
                child.material.depthWrite = !isClean; // clean overlay doesn't write depth
                child.material.needsUpdate = true;
            }
        });
        scene.add(model);
    };

    // Load Sneaker
    loader.load('/static/models/shoe_dirty.glb', (gltf) => {
        models.sneaker.dirty = gltf.scene;
        setupModel(models.sneaker.dirty, false, 1);
    });
    loader.load('/static/models/shoe_clean.glb', (gltf) => {
        models.sneaker.clean = gltf.scene;
        setupModel(models.sneaker.clean, false, 0, true);
        models.sneaker.loaded = true;
    });

    // Load Curtain
    loader.load('/static/models/curtain_dirty.glb', (gltf) => {
        models.curtain.dirty = gltf.scene;
        setupModel(models.curtain.dirty, false, 1);
    });
    loader.load('/static/models/curtain_clean.glb', (gltf) => {
        models.curtain.clean = gltf.scene;
        setupModel(models.curtain.clean, false, 0, true);
        models.curtain.loaded = true;
    });

    loader.load('/static/models/carpet_dirty.glb', (gltf) => {
        models.carpet.dirty = gltf.scene;
        // The carpet models tend to load very large in Three.js sometimes, so we'll apply the setupModel
        // but might need adjustment later if we see scaling issues.
        setupModel(models.carpet.dirty, false, 1);
        models.carpet.dirty.rotation.x = Math.PI / 2; // Face the camera for a top view
    });

    loader.load('/static/models/carpet_clean.glb', (gltf) => {
        models.carpet.clean = gltf.scene;
        setupModel(models.carpet.clean, false, 0, true);
        models.carpet.clean.rotation.x = Math.PI / 2; // Face the camera for a top view
        models.carpet.loaded = true;
    });

    // Animation Loop
    const clock = new THREE.Clock();
    let isExperienceActive = false;
    let currentSliderValue = 0;

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        Object.keys(models).forEach(cat => {
            const m = models[cat];
            if (m.dirty && m.clean) {
                if (!isExperienceActive) {
                    // Only rotate if this is the active category and we are NOT in experience
                    // Actually, let's keep idle rotation for the sneaker on landing
                    if (cat === 'sneaker') {
                        m.dirty.rotation.y = time * 0.2;
                        m.clean.rotation.y = time * 0.2;
                    }
                } else if (cat === activeCategory) {
                    // Smooth interp for active category
                    const targetRotation = currentSliderValue * Math.PI * 2;
                    m.dirty.rotation.y += (targetRotation - m.dirty.rotation.y) * 0.1;
                    m.clean.rotation.y += (targetRotation - m.clean.rotation.y) * 0.1;
                }
            }
        });

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

        // Update model scales on resize
        const newScale = getTargetScale();
        Object.keys(models).forEach(cat => {
            ['dirty', 'clean'].forEach(type => {
                if (models[cat][type]) {
                    models[cat][type].scale.set(newScale, newScale, newScale);
                }
            });
        });
    });

    // --- Experience Mode Logic ---

    window.enterExperienceMode = function () {
        isExperienceActive = true;
        switchExperienceCategory(activeCategory);
        gsap.to(camera.position, { duration: 1.5, z: 5, y: -0.5, ease: "power2.out" });
    };

    window.exitExperienceMode3D = function () {
        isExperienceActive = false;
        // Hide all
        Object.keys(models).forEach(cat => {
            if (models[cat].dirty) models[cat].dirty.visible = false;
            if (models[cat].clean) models[cat].clean.visible = false;
        });
        gsap.to(camera.position, { duration: 1.5, z: 5, y: 0, ease: "power2.out" });
    };

    window.switchExperienceCategory = function (category) {
        activeCategory = category;
        currentSliderValue = 0; // Reset

        Object.keys(models).forEach(cat => {
            const isTarget = (cat === category);
            if (models[cat].dirty) {
                models[cat].dirty.visible = isTarget;
                models[cat].dirty.rotation.y = 0; // Reset rotation on switch
            }
            if (models[cat].clean) {
                models[cat].clean.visible = isTarget;
                models[cat].clean.rotation.y = 0;
            }
        });

        updateShoeDissolve(0); // Sync opacity
    };

    window.updateShoeDissolve = function (progress) {
        currentSliderValue = progress;
        const m = models[activeCategory];
        if (m && m.dirty && m.clean) {
            m.dirty.traverse(c => { if (c.isMesh) c.material.opacity = 1 - progress; });
            m.clean.traverse(c => { if (c.isMesh) c.material.opacity = progress; });
        }
    };
} else {
    console.warn("Canvas container not found. 3D scene initialization skipped.");
}
