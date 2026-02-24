// Basic Three.js Scene Setup for Featherlite Prototype

const container = document.getElementById('canvas-container');

if (container) {
    // Scene
    const scene = new THREE.Scene();
    // Fog for depth (Charcoal fade)
    scene.fog = new THREE.FogExp2(0x0f0f11, 0.02); // Match bg color

    // Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const cameraDistance = window.innerWidth < 768 ? 6 : 5; // Start slightly further on mobile
    camera.position.set(0, 0, cameraDistance);

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
    let targetRestorationValue = 0; // For smooth interpolation

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
            sneaker: isMobile ? 1.0 : 1.6,
            curtain: isMobile ? 0.7 : 1.2,
            carpet: isMobile ? 0.65 : 1.1
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
        model.renderOrder = isClean ? 2 : 1; // Clean on top for transparency

        model.traverse((child) => {
            if (child.isMesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = isClean ? restorationValue : (1 - restorationValue);
                    mat.depthWrite = !isClean; // Disable depth write for the top layer if it's transparent
                    mat.needsUpdate = true;
                });
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
        }, undefined, (error) => {
            console.error(`Error loading clean model for ${cat}:`, error);
            // Even on error, mark as "loaded" so fallback/UI can proceed
            models[cat].clean = new THREE.Group(); // Empty group as fallback
            checkLoaded(cat);
        });
        loader.load(dirtyPath, (gltf) => {
            models[cat].dirty = gltf.scene;
            setupModel(models[cat].dirty, cat, cat === activeCategory, false);
            checkLoaded(cat);
        }, undefined, (error) => {
            console.error(`Error loading dirty model for ${cat}:`, error);
            models[cat].dirty = new THREE.Group(); // Empty group as fallback
            checkLoaded(cat);
        });
    }

    // Initially load ONLY the sneaker
    loadCategoryModels('sneaker');

    // Dissolve / Wipe Logic (Consolidated)
    window.updateShoeDissolve = (value) => {
        targetRestorationValue = parseFloat(value);
        // Force an immediate update for models that are already loaded
        if (Math.abs(restorationValue - targetRestorationValue) < 0.01) {
            window.updateDissolveMaterials(targetRestorationValue);
        }
    };

    window.updateDissolveMaterials = (value) => {
        restorationValue = value;
        const currentClean = models[activeCategory].clean;
        const currentDirty = models[activeCategory].dirty;

        if (!currentClean || !currentDirty) return;

        [currentClean, currentDirty].forEach((model, idx) => {
            const isClean = idx === 0;
            model.traverse(child => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = isClean ? value : (1 - value);
                        // If fully opaque or fully transparent, toggling depthWrite helps performance/depth sorting
                        mat.depthWrite = isClean ? (value > 0.95) : (value < 0.05);
                    });
                }
            });
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

            // Ensure Z-fighting is avoided by sorting and small bias
            models[activeCategory].clean.renderOrder = 2;
            models[activeCategory].dirty.renderOrder = 1;

            window.updateDissolveMaterials(restorationValue);
        }
    };

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        // Skip rendering if document is hidden to save battery/resources
        if (document.hidden) return;

        const time = clock.getElapsedTime();
        const delta = clock.getDelta();

        // Smoothly interpolate restoration value (Lerp)
        if (Math.abs(restorationValue - targetRestorationValue) > 0.001) {
            const lerpFactor = 8 * delta; // Slightly faster for responsiveness
            const newValue = restorationValue + (targetRestorationValue - restorationValue) * Math.min(lerpFactor, 1);
            window.updateDissolveMaterials(newValue);
        }

        // Rotate active models
        if (models[activeCategory].loaded) {
            const rotationSpeed = 0.2;
            if (models[activeCategory].clean) models[activeCategory].clean.rotation.y = time * rotationSpeed;
            if (models[activeCategory].dirty) models[activeCategory].dirty.rotation.y = time * rotationSpeed;
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
