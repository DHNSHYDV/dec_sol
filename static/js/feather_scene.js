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
        sneaker: { clean: null, dirty: null, loaded: false, cleanUrl: '/static/models/shoe_clean.glb', dirtyUrl: '/static/models/shoe_dirty.glb' },
        curtain: { clean: null, dirty: null, loaded: false, cleanUrl: '/static/models/curtain_clean.glb', dirtyUrl: '/static/models/curtain_dirty.glb' },
        carpet: { clean: null, dirty: null, loaded: false, cleanUrl: '/static/models/carpet_clean.glb', dirtyUrl: '/static/models/carpet_dirty.glb' }
    };

    let activeCategory = 'sneaker';
    let restorationValue = 0;

    const manager = new THREE.LoadingManager();
    manager.onLoad = () => {
        console.log("All models loaded");
        window.dispatchEvent(new Event('modelsLoaded'));
    };
    const loader = new THREE.GLTFLoader(manager);

    // Helper to setup model
    // Helper to setup model
    const getTargetScale = (cat) => {
        const isMobile = window.innerWidth < 768;
        const scales = {
            sneaker: isMobile ? 0.6 : 1.1,
            curtain: isMobile ? 0.4 : 0.8,
            carpet: isMobile ? 0.5 : 1.0
        };
        return scales[cat] || 1;
    };

    const setupModel = (model, cat, startVisible, isClean) => {
        const scale = getTargetScale(cat);
        model.scale.set(scale, scale, scale);

        // Vertical offset adjustments (centered)
        const offsets = {
            sneaker: -0.2,
            curtain: -0.2,
            carpet: 0
        };
        model.position.set(0, offsets[cat] || 0, 0);

        if (cat === 'carpet') {
            model.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
        } else {
            model.rotation.set(0, 0, 0);
        }

        model.visible = startVisible;

        model.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = true;
                // Important: for fade to work, starting opacity must be set
                child.material.opacity = isClean ? restorationValue : (1 - restorationValue);
                child.material.needsUpdate = true;
            }
        });
        scene.add(model);
    };

    function checkLoaded(cat) {
        if (models[cat].clean && models[cat].dirty) {
            models[cat].loaded = true;
            if (cat === activeCategory) {
                window.updateShoeDissolve(restorationValue);
                if (cat === 'sneaker') {
                    console.log("Sneaker models loaded");
                    window.dispatchEvent(new Event('modelsLoaded'));
                } else {
                    // Hide global loading spinner if it reappeared during lazy load
                    const loader = document.getElementById('loading-overlay');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => loader.style.display = 'none', 500);
                    }
                }
            }
        }
    }

    // Lazy Loader Function
    function loadCategoryModels(cat) {
        if (models[cat].loaded || models[cat].cleanUrl === null) return; // Already loaded or loading

        console.log(`Lazy loading: ${cat}`);
        // Nullify URL to indicate load in progress to prevent duplicate firing
        const cleanPath = models[cat].cleanUrl;
        const dirtyPath = models[cat].dirtyUrl;
        models[cat].cleanUrl = null;

        loader.load(cleanPath, (gltf) => {
            models[cat].clean = gltf.scene;
            setupModel(models[cat].clean, cat, cat === activeCategory, true);
            checkLoaded(cat);
        });
        loader.load(dirtyPath, (gltf) => {
            models[cat].dirty = gltf.scene;
            setupModel(models[cat].dirty, cat, cat === activeCategory, false);
            checkLoaded(cat);
        });
    }

    // Initially load ONLY the sneaker
    loadCategoryModels('sneaker');

    // Dissolve / Wipe Logic
    window.updateShoeDissolve = (value) => {
        restorationValue = value;
        const currentClean = models[activeCategory].clean;
        const currentDirty = models[activeCategory].dirty;

        if (!currentClean || !currentDirty) return;

        // Simple cross-fade / dissolve
        currentClean.traverse(child => {
            if (child.isMesh) child.material.opacity = value;
        });
        currentDirty.traverse(child => {
            if (child.isMesh) child.material.opacity = 1 - value;
        });
    };

    // Switching Logic
    window.switchExperienceCategory = (category) => {
        if (!models[category]) return;
        activeCategory = category;

        // Load models for this category if not already loaded
        if (!models[category].loaded) {
            // Show loading spinner while fetching lazy models
            const loaderOverlay = document.getElementById('loading-overlay');
            if (loaderOverlay) {
                loaderOverlay.style.display = 'flex';
                loaderOverlay.style.opacity = '1';
                // Remove text so it just shows spinner
                const loadingText = loaderOverlay.querySelector('.loading-text');
                if (loadingText) loadingText.textContent = "Loading Model...";
            }
            loadCategoryModels(category);
        }

        // Hide all models
        Object.keys(models).forEach(cat => {
            if (models[cat].clean) models[cat].clean.visible = false;
            if (models[cat].dirty) models[cat].dirty.visible = false;
        });

        // Show selected category models (if they are loaded)
        if (models[category].loaded) {
            if (models[category].clean) models[category].clean.visible = true;
            if (models[category].dirty) models[category].dirty.visible = true;

            // Re-apply original scales without the 0.995 hack
            const targetScale = getTargetScale(category);
            models[activeCategory].clean.scale.set(targetScale, targetScale, targetScale);
            models[activeCategory].dirty.scale.set(targetScale, targetScale, targetScale);

            // Fix Z-fighting by slightly nudging the dirty model backwards relative to the camera
            models[activeCategory].clean.position.z = 0;
            models[activeCategory].dirty.position.z = -0.01;

            window.updateShoeDissolve(restorationValue);
        }
    };

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        // Rotate active models (All use Y rotation. For carpet, since X is 90 deg, local Y axis points to camera, creating a pinwheel spin.)
        if (models[activeCategory].loaded) {
            if (models[activeCategory].clean) models[activeCategory].clean.rotation.y = time * 0.2;
            if (models[activeCategory].dirty) models[activeCategory].dirty.rotation.y = time * 0.2;
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

        Object.keys(models).forEach(cat => {
            if (models[cat].loaded) {
                const newScale = getTargetScale(cat);
                if (models[cat].clean) models[cat].clean.scale.set(newScale, newScale, newScale);
                if (models[cat].dirty) models[cat].dirty.scale.set(newScale, newScale, newScale);
            }
        });
    });

    // Compatibility dummies
    window.enterExperienceMode = () => { };
    window.exitExperienceMode3D = () => { };
} else {
    console.warn("Canvas container not found. 3D scene initialization skipped.");
}
