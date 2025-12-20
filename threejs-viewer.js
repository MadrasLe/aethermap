/**
 * AetherMap Three.js 3D Viewer
 * Premium visualization with realistic spheres, lighting, and smooth interactions
 */

class AetherMapViewer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            backgroundColor: 0x030303,
            sphereRadius: 0.15,
            sphereSegments: 16,
            autoRotate: true,
            autoRotateSpeed: 0.3,
            ...options
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.spheres = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredSphere = null;
        this.selectedSphere = null;
        this.data = [];
        this.onPointClick = null;
        this.onPointHover = null;

        // Cluster colors - matching CSS palette
        this.CLUSTER_COLORS = [
            0x818cf8, // Indigo
            0x34d399, // Emerald
            0xf472b6, // Pink
            0xfbbf24, // Amber
            0x60a5fa, // Blue
            0xa78bfa, // Purple
            0x22d3ee, // Cyan
            0xfb7185, // Rose
            0x4ade80, // Green
            0xc084fc  // Violet
        ];

        this.NOISE_COLOR = 0x4a5568;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.updateBackgroundColor();

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(15, 15, 15);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        this.setupLights();

        // Controls
        this.setupControls();

        // Grid helper
        this.setupGrid();

        // Events
        this.setupEvents();

        // Start animation loop
        this.animate();
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.3);
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);

        // Point light for accent
        const pointLight = new THREE.PointLight(0x60a5fa, 0.5, 50);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = this.options.autoRotate;
        this.controls.autoRotateSpeed = this.options.autoRotateSpeed;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI * 0.9;
    }

    setupGrid() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const gridColor = isDark ? 0x1a1a2e : 0xe5e7eb;

        // Create custom grid
        const gridSize = 30;
        const gridDivisions = 30;
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        gridHelper.position.y = -5;
        this.scene.add(gridHelper);
        this.gridHelper = gridHelper;
    }

    setupEvents() {
        // Resize
        window.addEventListener('resize', () => this.onResize());

        // Mouse events
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));

        // Stop auto-rotate on interaction
        this.controls.addEventListener('start', () => {
            this.controls.autoRotate = false;
        });
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.checkHover();
    }

    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.spheres);

        // Reset previous hover
        if (this.hoveredSphere && this.hoveredSphere !== this.selectedSphere) {
            this.hoveredSphere.scale.setScalar(1);
            this.hoveredSphere.material.emissiveIntensity = 0.1;
        }

        if (intersects.length > 0) {
            this.hoveredSphere = intersects[0].object;
            this.hoveredSphere.scale.setScalar(1.5);
            this.hoveredSphere.material.emissiveIntensity = 0.4;
            this.renderer.domElement.style.cursor = 'pointer';

            if (this.onPointHover) {
                this.onPointHover(this.hoveredSphere.userData);
            }
        } else {
            this.hoveredSphere = null;
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    onClick(event) {
        if (this.hoveredSphere) {
            // Reset previous selection
            if (this.selectedSphere) {
                this.selectedSphere.scale.setScalar(1);
                this.selectedSphere.material.emissiveIntensity = 0.1;
            }

            this.selectedSphere = this.hoveredSphere;
            this.selectedSphere.scale.setScalar(2);
            this.selectedSphere.material.emissiveIntensity = 0.6;

            if (this.onPointClick) {
                this.onPointClick(this.selectedSphere.userData);
            }
        }
    }

    loadData(plotData) {
        // Clear existing spheres
        this.spheres.forEach(sphere => {
            this.scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
        });
        this.spheres = [];
        this.data = plotData;

        // Find data bounds for normalization
        const xValues = plotData.map(p => p.x);
        const yValues = plotData.map(p => p.y);
        const zValues = plotData.map(p => p.z);

        const bounds = {
            x: { min: Math.min(...xValues), max: Math.max(...xValues) },
            y: { min: Math.min(...yValues), max: Math.max(...yValues) },
            z: { min: Math.min(...zValues), max: Math.max(...zValues) }
        };

        const normalize = (val, min, max) => {
            const range = max - min || 1;
            return ((val - min) / range - 0.5) * 20; // Scale to -10 to 10
        };

        // Create spheres
        const geometry = new THREE.SphereGeometry(
            this.options.sphereRadius,
            this.options.sphereSegments,
            this.options.sphereSegments
        );

        plotData.forEach((point, index) => {
            const isNoise = point.cluster === '-1' || point.cluster === -1;
            const colorIndex = isNoise ? -1 : parseInt(point.cluster) % this.CLUSTER_COLORS.length;
            const color = isNoise ? this.NOISE_COLOR : this.CLUSTER_COLORS[colorIndex];

            const material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.3,
                roughness: 0.4,
                emissive: color,
                emissiveIntensity: isNoise ? 0.05 : 0.1
            });

            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(
                normalize(point.x, bounds.x.min, bounds.x.max),
                normalize(point.y, bounds.y.min, bounds.y.max),
                normalize(point.z, bounds.z.min, bounds.z.max)
            );

            // Smaller spheres for noise
            if (isNoise) {
                sphere.scale.setScalar(0.6);
            }

            // Store data reference
            sphere.userData = { ...point, index };

            this.scene.add(sphere);
            this.spheres.push(sphere);
        });

        // Reset camera
        this.resetCamera();
    }

    resetCamera() {
        this.camera.position.set(15, 15, 15);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.autoRotate = this.options.autoRotate;
    }

    highlightPoints(indices, highlightColor = 0xfef08a) {
        this.spheres.forEach((sphere) => {
            // Compare with the original data index, not loop index
            const pointIndex = sphere.userData.index;

            if (indices.includes(pointIndex)) {
                // Highlight this sphere
                sphere.material.color.setHex(highlightColor);
                sphere.material.emissive.setHex(highlightColor);
                sphere.material.emissiveIntensity = 0.6;
                sphere.scale.setScalar(2.0);
                sphere.material.opacity = 1;
                sphere.material.transparent = false;
            } else {
                // Dim other points
                sphere.material.opacity = 0.15;
                sphere.material.transparent = true;
                sphere.material.emissiveIntensity = 0.02;
            }
        });
    }

    resetHighlight() {
        this.spheres.forEach((sphere) => {
            const point = sphere.userData;
            const isNoise = point.cluster === '-1' || point.cluster === -1;
            const colorIndex = isNoise ? -1 : parseInt(point.cluster) % this.CLUSTER_COLORS.length;
            const color = isNoise ? this.NOISE_COLOR : this.CLUSTER_COLORS[colorIndex];

            sphere.material.color.setHex(color);
            sphere.material.emissive.setHex(color);
            sphere.material.emissiveIntensity = isNoise ? 0.05 : 0.1;
            sphere.material.opacity = 1;
            sphere.material.transparent = false;
            sphere.scale.setScalar(isNoise ? 0.6 : 1);
        });
    }

    updateTheme() {
        this.updateBackgroundColor();

        // Update grid
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper.geometry.dispose();
            this.gridHelper.material.dispose();
        }
        this.setupGrid();
    }

    updateBackgroundColor() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        this.scene.background = null; // Transparent background
    }

    // Knowledge Graph - Render edges between connected documents
    renderEdges(edges, plotData) {
        // Clear existing edges first
        this.clearEdges();

        if (!edges || edges.length === 0) return;

        // Create edge lines
        this.edgeLines = [];

        // Edge colors by entity type
        const typeColors = {
            'PERSON': 0x60a5fa, // Blue
            'PER': 0x60a5fa,
            'ORG': 0x34d399,   // Green
            'GPE': 0xf472b6,   // Pink
            'LOC': 0xf472b6
        };

        edges.forEach(edge => {
            const sourcePoint = plotData[edge.source];
            const targetPoint = plotData[edge.target];

            if (!sourcePoint || !targetPoint) return;

            // Find sphere positions
            const sourceSphere = this.spheres[edge.source];
            const targetSphere = this.spheres[edge.target];

            if (!sourceSphere || !targetSphere) return;

            const points = [
                sourceSphere.position.clone(),
                targetSphere.position.clone()
            ];

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const color = typeColors[edge.entity_type] || 0xffffff;
            const material = new THREE.LineBasicMaterial({
                color: color,
                opacity: 0.4,
                transparent: true
            });

            const line = new THREE.Line(geometry, material);
            line.userData = { entity: edge.entity, type: edge.entity_type };

            this.scene.add(line);
            this.edgeLines.push(line);
        });

        console.log(`Rendered ${this.edgeLines.length} edges`);
    }

    clearEdges() {
        if (this.edgeLines) {
            this.edgeLines.forEach(line => {
                line.geometry.dispose();
                line.material.dispose();
                this.scene.remove(line);
            });
            this.edgeLines = [];
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        // Clean up edges
        this.clearEdges();
        // Clean up spheres
        this.spheres.forEach(sphere => {
            sphere.geometry.dispose();
            sphere.material.dispose();
        });
        this.renderer.dispose();
        this.controls.dispose();
    }
}

// Export for use in main script
window.AetherMapViewer = AetherMapViewer;
