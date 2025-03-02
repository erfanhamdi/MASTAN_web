// Fixed implementation using ES modules for Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variables
let scene, camera, renderer, controls;
let nodes = [];
let elements = [];
let selectedNodes = [];
let nodeObjects = {};
let elementObjects = {};
let originalPositions = {};
let nodeLoadingBC = {};  // Store loading and boundary conditions for each node
let elementProperties = {};  // Store properties for each element
let raycaster, mouse;  // For node selection in 3D scene
let selectedElement = null;  // Currently selected element in Node/Element Type tab
let currentDeformationScale = 1;  // Default deformation scale value

// Constants for visualization
const CYLINDER_RADIUS = 0.1;
const NODE_RADIUS = 0.2;

// Loading/BC field names
const LOADING_BC_FIELDS = [
    'u_x', 'u_y', 'u_z', 'theta_x', 'theta_y', 'theta_z',
    'F_x', 'F_y', 'F_z', 'M_x', 'M_y', 'M_z'
];

// Element property field names
const ELEMENT_PROPERTY_FIELDS = [
    'E', 'A', 'J', 'Iy', 'Iz', 'nu', 'local_z'
];

// Global variable to track deformed shape visibility
let deformedShapeVisible = false;
let lastDeformedShapes = null;

// Toggle the visibility of the deformed shape
function toggleDeformedShape() {
    const toggleBtn = document.getElementById('toggle-deformed-btn');
    
    if (!lastDeformedShapes) {
        console.log('No deformed shape data available');
        return;
    }
    
    deformedShapeVisible = !deformedShapeVisible;
    
    if (deformedShapeVisible) {
        // Show deformed shape
        visualizeDeformedShape(lastDeformedShapes);
        toggleBtn.textContent = 'Hide Deformed Shape';
    } else {
        // Hide deformed shape
        removeDeformedShape();
        toggleBtn.textContent = 'Show Deformed Shape';
    }
}

// Remove the deformed shape from the scene
function removeDeformedShape() {
    console.log('Removing deformed shape elements');
    
    // Create a list of objects to remove
    const objectsToRemove = [];
    
    // Find all deformed shape objects
    scene.traverse(child => {
        if (child.userData && child.userData.isDeformedShape) {
            objectsToRemove.push(child);
        }
    });
    
    // Remove all found objects
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
    });
    
    // Update the scene
    renderer.render(scene, camera);
    console.log(`Removed ${objectsToRemove.length} deformed shape elements`);
}

// Update the element list in the UI
function updateElementList() {
    console.log('Updating element list', elements);
    const elementList = document.getElementById('element-list');
    
    if (!elementList) {
        console.error('Element list not found');
        return;
    }
    
    if (elements.length === 0) {
        elementList.innerHTML = '<div class="element-item">No elements created yet</div>';
        return;
    }
    
    elementList.innerHTML = '';
    elements.forEach(element => {
        const elementItem = document.createElement('div');
        elementItem.className = 'element-item';
        elementItem.textContent = `${element.id}: ${element.nodeIds[0]} to ${element.nodeIds[1]}`;
        elementList.appendChild(elementItem);
    });
    
    console.log('Element list updated successfully');
}

// Clear all elements
function clearElements() {
    console.log('Clearing all elements');
    
    // Remove all elements from scene
    elements.forEach(element => {
        scene.remove(elementObjects[element.id]);
    });
    
    // Clear arrays and objects
    elements = [];
    elementObjects = {};
    originalPositions = {};
    
    // Update UI
    updateElementList();
    
    console.log('All elements cleared successfully');
}

// Wait for the page to fully load before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, initializing application');
    
    // Initialize 3D scene
    initScene();
    
    // Initialize UI event handlers
    initUIHandlers();
    
    // Initialize tabs
    initializeTabs();
    
    // Start animation loop
    animate();
});

// Initialize the 3D scene
function initScene() {
    console.log('Initializing 3D scene');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Get container dimensions
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.error('Canvas container not found!');
        return;
    }
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    console.log(`Canvas size: ${width}x${height}`);

    // Create camera with better positioning
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Create renderer with explicit size
    try {
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height, false);
        
        // Clear any existing canvas
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        container.appendChild(renderer.domElement);
        console.log('Renderer created and canvas appended to container');
        
        // Debug canvas size
        console.log(`Canvas dimensions: ${renderer.domElement.width}x${renderer.domElement.height}`);
    } catch (error) {
        console.error('Error creating renderer:', error);
    }

    // Add controls with explicit target
    try {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.target.set(0, 0, 0);
        controls.update();
        console.log('Controls initialized successfully');
    } catch (error) {
        console.error('Error creating controls:', error);
    }

    // Add stronger lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Add larger grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    // Add larger axes helper
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
    
    // Initialize raycaster for node selection
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.1;
    mouse = new THREE.Vector2();
    
    // Add click event listener for node selection
    renderer.domElement.addEventListener('click', onCanvasClick);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    console.log('3D scene initialized successfully');
}

// Initialize UI event handlers
function initUIHandlers() {
    console.log('Initializing UI handlers');
    
    // Add node button
    const addNodeBtn = document.getElementById('add-node-btn');
    if (addNodeBtn) {
        addNodeBtn.addEventListener('click', addNode);
        console.log('Add node button handler attached');
    }
    
    // Clear nodes button
    const clearNodesBtn = document.getElementById('clear-nodes-btn');
    if (clearNodesBtn) {
        clearNodesBtn.addEventListener('click', clearNodes);
        console.log('Clear nodes button handler attached');
    }
    
    // Add element button
    const addElementBtn = document.getElementById('add-element-btn');
    if (addElementBtn) {
        addElementBtn.addEventListener('click', createElement);
        console.log('Add element button handler attached');
        addElementBtn.disabled = true;  // Disable until 2 nodes are selected
    }
    
    // Clear elements button
    const clearElementsBtn = document.getElementById('clear-elements-btn');
    if (clearElementsBtn) {
        clearElementsBtn.addEventListener('click', clearElements);
        console.log('Clear elements button handler attached');
    }
    
    // Calculate button
    const calculateBtn = document.getElementById('calculate-btn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', sendDataToServer);
        console.log('Calculate button handler attached');
    }
    
    // Apply deformation scale button
    const applyScaleBtn = document.getElementById('apply-scale-btn');
    if (applyScaleBtn) {
        applyScaleBtn.addEventListener('click', function() {
            const scaleInput = document.getElementById('deformationScale');
            if (scaleInput) {
                const newScale = parseFloat(scaleInput.value);
                if (isNaN(newScale) || newScale < 0) {
                    alert("Please enter a valid positive number for the deformation scale");
                    return;
                }
                
                currentDeformationScale = newScale;
                console.log(`Applying new deformation scale: ${currentDeformationScale}`);
                
                // Automatically trigger calculation with the new scale
                sendDataToServer();
            }
        });
        console.log('Apply scale button handler attached');
    }
    
    // Reset camera button
    const resetCameraBtn = document.getElementById('reset-camera-btn');
    if (resetCameraBtn) {
        resetCameraBtn.addEventListener('click', resetCamera);
        console.log('Reset camera button handler attached');
    }
    
    // Toggle deformed shape button
    const toggleDeformedBtn = document.getElementById('toggle-deformed-btn');
    if (toggleDeformedBtn) {
        toggleDeformedBtn.addEventListener('click', toggleDeformedShape);
        toggleDeformedBtn.disabled = true; // Disable until we have deformed shape data
        console.log('Toggle deformed shape button handler attached');
    }
    
    // Loading/BC handlers
    const nodeSelector = document.getElementById('node-selector');
    if (nodeSelector) {
        nodeSelector.addEventListener('change', function(event) {
            if (event.target.value) {
                loadNodeValues(event.target.value);
            }
        });
        console.log('Node selector handler attached');
    }
    
    const applyLoadingBC = document.getElementById('apply-loading-bc');
    if (applyLoadingBC) {
        applyLoadingBC.addEventListener('click', function() {
            const selectedNode = document.getElementById('node-selector').value;
            if (selectedNode) {
                saveNodeValues(selectedNode);
            }
        });
        console.log('Apply Loading/BC button handler attached');
    }

    // Element properties handlers
    const elementSelector = document.getElementById('element-selector');
    if (elementSelector) {
        elementSelector.addEventListener('change', function(event) {
            if (event.target.value) {
                loadElementValues(event.target.value);
            }
        });
        console.log('Element selector handler attached');
    }
    
    const applyElementProps = document.getElementById('apply-element-props');
    if (applyElementProps) {
        applyElementProps.addEventListener('click', function() {
            if (selectedElement) {
                saveElementValues(selectedElement);
            } else {
                console.warn('No element selected to apply properties');
            }
        });
        console.log('Apply Element Properties button handler attached');
    }

    // Tab navigation buttons
    const geometryAllSet = document.getElementById('geometry-all-set');
    if (geometryAllSet) {
        geometryAllSet.addEventListener('click', () => {
            const nodeTypeTab = document.querySelector('[data-tab="node-element-type"]');
            if (nodeTypeTab) nodeTypeTab.click();
        });
    }

    const nodeTypeAllSet = document.getElementById('node-type-all-set');
    if (nodeTypeAllSet) {
        nodeTypeAllSet.addEventListener('click', () => {
            const postprocessingTab = document.querySelector('[data-tab="postprocessing"]');
            if (postprocessingTab) postprocessingTab.click();
        });
    }
    
    console.log('All UI handlers initialized successfully');
}

// Update the calculation status display
function updateCalculationStatus(message, type, results = null) {
    const statusElement = document.getElementById('calculation-status');
    if (statusElement) {
        if (results) {
            // Format the results as HTML
            let html = `<div class="result-header">${message}</div>`;
            html += '<div class="result-details">';
            
            // Add basic information
            html += '<div class="result-section">';
            html += '<h3>Structure Information:</h3>';
            html += `<p>Node count: ${results.node_count}</p>`;
            html += `<p>Element count: ${results.element_count}</p>`;
            html += '</div>';
            
            // Add analysis results if available
            if (results.analysis_results) {
                // Add displacements table if available
                if (results.analysis_results.displacements && Array.isArray(results.analysis_results.displacements)) {
                    html += '<div class="result-section">';
                    html += '<h3>Displacements and Rotations:</h3>';
                    html += '<div class="table-container">';
                    html += '<table class="results-table">';
                    html += '<thead><tr><th>Node</th><th>DOF</th><th>Value</th></tr></thead>';
                    html += '<tbody>';
                    
                    results.analysis_results.displacements.forEach(item => {
                        html += `<tr>
                            <td>${item.node}</td>
                            <td>${item.dof}</td>
                            <td>${parseFloat(item.value).toExponential(4)}</td>
                        </tr>`;
                    });
                    
                    html += '</tbody></table>';
                    html += '</div></div>';
                }
                
                // Add reactions table if available
                if (results.analysis_results.reactions && Array.isArray(results.analysis_results.reactions)) {
                    html += '<div class="result-section">';
                    html += '<h3>Reaction Forces and Moments:</h3>';
                    html += '<div class="table-container">';
                    html += '<table class="results-table">';
                    html += '<thead><tr><th>Node</th><th>DOF</th><th>Value</th></tr></thead>';
                    html += '<tbody>';
                    
                    results.analysis_results.reactions.forEach(item => {
                        html += `<tr>
                            <td>${item.node}</td>
                            <td>${item.dof}</td>
                            <td>${parseFloat(item.value).toExponential(4)}</td>
                        </tr>`;
                    });
                    
                    html += '</tbody></table>';
                    html += '</div></div>';
                }
            }
            
            html += '</div>';
            
            statusElement.innerHTML = html;
            
            // If we have deformed shape data, store it and update the toggle button
            if (results.deformed_shapes && Array.isArray(results.deformed_shapes)) {
                lastDeformedShapes = results.deformed_shapes;
                
                // Enable the toggle button
                const toggleBtn = document.getElementById('toggle-deformed-btn');
                if (toggleBtn) {
                    toggleBtn.disabled = false;
                    
                    // Automatically show the deformed shape
                    deformedShapeVisible = true;
                    toggleBtn.textContent = 'Hide Deformed Shape';
                    visualizeDeformedShape(results.deformed_shapes);
                }
            }
        } else {
            statusElement.textContent = message;
        }
        statusElement.className = type ? type : '';
    }
}

// Visualize the deformed shape based on data from the server
function visualizeDeformedShape(deformedShapes) {
    console.log('Visualizing deformed shape:', deformedShapes);
    
    // Store the deformed shapes for later use
    lastDeformedShapes = deformedShapes;
    
    // Always remove any existing deformed shape visualization first
    removeDeformedShape();
    
    // If deformed shape is not visible, don't add it
    if (!deformedShapeVisible) {
        return;
    }
    
    // Create a material for the deformed shape
    const material = new THREE.MeshPhongMaterial({ 
        color: 0x00BFFF,  // Light blue color
        shininess: 30
    });
    
    // For each element's deformed shape
    deformedShapes.forEach(shapeData => {
        const elementIndex = shapeData.element_index;
        const shapePoints = shapeData.shape_data;
        const deformedNodes = shapeData.deformed_nodes;
        
        if (!Array.isArray(shapePoints) || shapePoints.length < 2) {
            console.warn(`Invalid shape data for element ${elementIndex}`);
            return;
        }
        
        // Create cylinders between each pair of points
        for (let i = 0; i < shapePoints.length - 1; i++) {
            const point1 = new THREE.Vector3(shapePoints[i][0], shapePoints[i][1], shapePoints[i][2]);
            const point2 = new THREE.Vector3(shapePoints[i+1][0], shapePoints[i+1][1], shapePoints[i+1][2]);
            
            // Calculate distance between points
            const distance = point1.distanceTo(point2);
            
            // Create cylinder geometry
            const geometry = new THREE.CylinderGeometry(CYLINDER_RADIUS * 0.8, CYLINDER_RADIUS * 0.8, distance, 8);
            const cylinder = new THREE.Mesh(geometry, material);
            
            // Position at midpoint
            cylinder.position.copy(point1).add(point2).multiplyScalar(0.5);
            
            // Orient to point from point1 to point2
            const direction = new THREE.Vector3().subVectors(point2, point1).normalize();
            
            // Create a quaternion from the direction vector
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            cylinder.quaternion.copy(quaternion);
            
            // Mark as deformed shape for later removal
            cylinder.userData = { isDeformedShape: true, elementIndex };
            
            // Add the cylinder to the scene
            scene.add(cylinder);
        }
        
        // Add spheres for deformed nodes
        if (Array.isArray(deformedNodes)) {
            for (let i = 0; i < deformedNodes.length; i++) {
                const node = deformedNodes[i];
                const geometry = new THREE.SphereGeometry(NODE_RADIUS, 16, 16);
                const nodeMaterial = new THREE.MeshPhongMaterial({ color: 0x00BFFF });
                const nodeMesh = new THREE.Mesh(geometry, nodeMaterial);
                nodeMesh.position.set(node[0], node[1], node[2]);
                
                // Mark as deformed shape for later removal
                nodeMesh.userData = { isDeformedShape: true, nodeIndex: i };
                
                scene.add(nodeMesh);
            }
        }
    });
    
    // Update the scene
    renderer.render(scene, camera);
}

// Send node data to Python server for calculations
function sendDataToServer() {
    console.log('Sending node data to server for calculations');
    
    // Check if we have nodes to send
    if (nodes.length === 0) {
        updateCalculationStatus('No nodes to calculate. Please add nodes first.', 'error');
        return;
    }
    
    // Prepare data to send
    const nodeData = nodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z,
        loadingBC: nodeLoadingBC[node.id] || {}  // Include loading/BC data if it exists
    }));
    
    const elementData = elements.map(element => ({
        id: element.id,
        nodeIds: element.nodeIds,
        properties: elementProperties[element.id] || {}  // Include element properties if they exist
    }));
    
    // Get the current deformation scale value from the textbox
    const deformationScaleValue = document.getElementById('deformationScale').value;
    const scaleValue = parseFloat(deformationScaleValue);
    
    // Validate the scale value
    if (isNaN(scaleValue) || scaleValue < 0) {
        updateCalculationStatus('Please enter a valid positive number for the deformation scale', 'error');
        return;
    }
    
    // Update the current scale value
    currentDeformationScale = scaleValue;
    
    const data = {
        nodes: nodeData,
        elements: elementData,
        deformationScale: currentDeformationScale  // Use the validated scale value
    };
    
    // Update status
    updateCalculationStatus('Sending data to server...', '');
    
    // Send data to server
    fetch('/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Calculation successful:', data);
        updateCalculationStatus('Calculation completed successfully!', 'success', data.results);
    })
    .catch(error => {
        console.error('Error during calculation:', error);
        updateCalculationStatus(`Error: ${error.message}`, 'error');
    });
}

// Add a new node
function addNode() {
    console.log('Adding node');
    
    // Get coordinates from input fields
    const x = parseFloat(document.getElementById('node-x').value);
    const y = parseFloat(document.getElementById('node-y').value);
    const z = parseFloat(document.getElementById('node-z').value);
    
    console.log(`Node coordinates: (${x}, ${y}, ${z})`);
    
    // Create node object
    const nodeId = `node-${nodes.length}`;
    const node = { id: nodeId, x, y, z };
    nodes.push(node);
    
    // Create visual representation
    const geometry = new THREE.SphereGeometry(NODE_RADIUS, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0x4CAF50 });
    const nodeMesh = new THREE.Mesh(geometry, material);
    nodeMesh.position.set(x, y, z);
    nodeMesh.userData = { type: 'node', id: nodeId };
    scene.add(nodeMesh);
    
    // Store reference
    nodeObjects[nodeId] = nodeMesh;
    
    // Update UI
    updateNodeList();
    updateNodeSelector();
    
    console.log(`Node ${nodeId} added successfully`);
}

// Update the node list in the UI
function updateNodeList() {
    console.log('Updating node list', nodes);
    const nodeList = document.getElementById('geometry-node-list');
    
    if (!nodeList) {
        console.error('Node list element not found');
        return;
    }
    
    if (nodes.length === 0) {
        nodeList.innerHTML = '<div class="node-item">No nodes added yet</div>';
        return;
    }
    
    nodeList.innerHTML = '';
    nodes.forEach(node => {
        const nodeItem = document.createElement('div');
        nodeItem.className = 'node-item';
        if (selectedNodes.includes(node.id)) {
            nodeItem.className += ' selected';
        }
        nodeItem.textContent = `${node.id}: (${node.x}, ${node.y}, ${node.z})`;
        nodeItem.dataset.nodeId = node.id;
        
        // Add click handler to select/deselect node
        nodeItem.addEventListener('click', function() {
            toggleNodeSelection(node.id);
        });
        
        nodeList.appendChild(nodeItem);
    });
    
    console.log('Node list updated successfully');
}

// Toggle node selection
function toggleNodeSelection(nodeId) {
    console.log(`Toggling selection for node ${nodeId}`);
    const index = selectedNodes.indexOf(nodeId);
    
    // If node is already selected, deselect it
    if (index !== -1) {
        selectedNodes.splice(index, 1);
        nodeObjects[nodeId].material.color.set(0x4CAF50); // Reset color
        console.log(`Node ${nodeId} deselected`);
    } 
    // If we have less than 2 nodes selected, select this one
    else if (selectedNodes.length < 2) {
        selectedNodes.push(nodeId);
        nodeObjects[nodeId].material.color.set(0xff0000); // Highlight selected node
        console.log(`Node ${nodeId} selected`);
    }
    
    // Update create element button state
    document.getElementById('add-element-btn').disabled = selectedNodes.length !== 2;
    
    // Update node list UI
    updateNodeList();
}

// Create an element between two selected nodes
function createElement() {
    if (selectedNodes.length !== 2) {
        console.log('Cannot create element: need exactly 2 selected nodes');
        return;
    }
    
    console.log(`Creating element between nodes ${selectedNodes[0]} and ${selectedNodes[1]}`);
    
    const elementId = `element-${elements.length}`;
    const element = {
        id: elementId,
        nodeIds: [...selectedNodes]
    };
    
    elements.push(element);
    
    // Create visual representation of element (cylinder)
    const node1 = nodeObjects[selectedNodes[0]].position;
    const node2 = nodeObjects[selectedNodes[1]].position;
    
    // Calculate distance between nodes
    const distance = new THREE.Vector3().subVectors(node2, node1).length();
    
    // Create cylinder geometry
    const geometry = new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, distance, 8);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const cylinder = new THREE.Mesh(geometry, material);
    
    // Position and orient the cylinder
    // First, position it at the midpoint between the two nodes
    cylinder.position.copy(node1).add(node2).multiplyScalar(0.5);
    
    // Then, orient it to point from node1 to node2
    // We need to align the cylinder's Y axis with the direction vector
    const direction = new THREE.Vector3().subVectors(node2, node1).normalize();
    
    // Create a quaternion from the direction vector
    // The default cylinder orientation is along the Y axis
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    cylinder.quaternion.copy(quaternion);
    
    cylinder.userData = { 
        type: 'element', 
        id: elementId,
        nodeIds: [...selectedNodes]
    };
    
    scene.add(cylinder);
    
    // Store reference to the element object
    elementObjects[elementId] = cylinder;
    
    // Store original positions for deformation
    originalPositions[elementId] = [
        { x: node1.x, y: node1.y, z: node1.z },
        { x: node2.x, y: node2.y, z: node2.z }
    ];
    
    // Clear selection
    selectedNodes.forEach(nodeId => {
        nodeObjects[nodeId].material.color.set(0x4CAF50);
    });
    selectedNodes = [];
    document.getElementById('add-element-btn').disabled = true;
    
    // Update element list in UI
    updateElementList();
    updateNodeList();
    updateElementSelector();
    
    console.log(`Element ${elementId} created successfully`);
}

// Update the node selector in the Loading/BC section
function updateNodeSelector() {
    const nodeSelect = document.getElementById('node-selector');
    nodeSelect.innerHTML = '<option value="">Select a node...</option>';
    
    nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = `${node.id}: (${node.x}, ${node.y}, ${node.z})`;
        nodeSelect.appendChild(option);
    });
}

// Handle canvas click for node selection
function onCanvasClick(event) {
    // Get the active tab
    const nodeTypeTab = document.getElementById('node-element-type');
    if (!nodeTypeTab || !nodeTypeTab.classList.contains('active')) {
        return; // Only process clicks when in the Node/Element Type tab
    }
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Find intersections with nodes and elements
    const nodeObjectsArray = Object.values(nodeObjects);
    const elementObjectsArray = Object.values(elementObjects);
    const allObjects = [...nodeObjectsArray, ...elementObjectsArray];
    
    const intersects = raycaster.intersectObjects(allObjects);
    
    if (intersects.length > 0) {
        // Get the first intersected object
        const selectedObject = intersects[0].object;
        
        if (selectedObject.userData && selectedObject.userData.type === 'node') {
            // Handle node selection
            const nodeId = selectedObject.userData.id;
            console.log(`Node selected via 3D click: ${nodeId}`);
            
            // Update the node selector dropdown
            const nodeSelector = document.getElementById('node-selector');
            if (nodeSelector) {
                nodeSelector.value = nodeId;
                
                // Trigger the change event to load node values
                const event = new Event('change');
                nodeSelector.dispatchEvent(event);
                
                // Highlight the selected node
                highlightSelectedNode(nodeId);
            }
        } 
        else if (selectedObject.userData && selectedObject.userData.type === 'element') {
            // Handle element selection
            const elementId = selectedObject.userData.id;
            console.log(`Element selected via 3D click: ${elementId}`);
            
            // Update the element selector dropdown
            const elementSelector = document.getElementById('element-selector');
            if (elementSelector) {
                elementSelector.value = elementId;
                
                // Trigger the change event to load element values
                const event = new Event('change');
                elementSelector.dispatchEvent(event);
                
                // Highlight the selected element
                highlightSelectedElement(elementId);
            }
        }
    }
}

// Highlight the selected node in the 3D scene
function highlightSelectedNode(nodeId) {
    // Reset all node colors first
    Object.entries(nodeObjects).forEach(([id, obj]) => {
        // If node has loading/BC, keep it orange, otherwise set to default green
        if (nodeLoadingBC[id] && Object.keys(nodeLoadingBC[id]).length > 0) {
            obj.material.color.set(0xFFA500); // Orange
        } else {
            obj.material.color.set(0x4CAF50); // Green
        }
    });
    
    // Highlight the selected node if it's not already highlighted
    const nodeObj = nodeObjects[nodeId];
    if (nodeObj) {
        // Use a bright blue color for the selected node in the Node/Element Type tab
        nodeObj.material.color.set(0x00BFFF); // Deep sky blue
        
        // Make the node slightly larger to emphasize selection
        nodeObj.scale.set(1.2, 1.2, 1.2);
        
        // Reset scale of other nodes
        Object.entries(nodeObjects).forEach(([id, obj]) => {
            if (id !== nodeId) {
                obj.scale.set(1, 1, 1);
            }
        });
    }
}

// Load existing values for a node into the Loading/BC inputs
function loadNodeValues(nodeId) {
    const values = nodeLoadingBC[nodeId] || {};
    
    // Clear all inputs first
    LOADING_BC_FIELDS.forEach(field => {
        document.getElementById(field).value = '';
    });
    
    // Set existing values
    Object.entries(values).forEach(([field, value]) => {
        const input = document.getElementById(field);
        if (input) {
            input.value = value;
        }
    });
    
    // Highlight the selected node in the 3D scene
    highlightSelectedNode(nodeId);
}

// Save Loading/BC values for a node
function saveNodeValues(nodeId) {
    const values = {};
    let hasValues = false;
    
    // Collect non-empty values
    LOADING_BC_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        if (input && input.value !== '') {
            values[field] = parseFloat(input.value);
            hasValues = true;
        }
    });
    
    if (hasValues) {
        nodeLoadingBC[nodeId] = values;
        // Update node visualization to indicate it has BC/loading
        if (nodeObjects[nodeId]) {
            nodeObjects[nodeId].material.color.set(0xFFA500); // Orange color for nodes with BC/loading
        }
    } else {
        delete nodeLoadingBC[nodeId];
        // Reset node color if no BC/loading
        if (nodeObjects[nodeId]) {
            nodeObjects[nodeId].material.color.set(0x4CAF50);
        }
    }
    
    // Update status
    const statusElement = document.getElementById('loading-bc-status');
    if (statusElement) {
        statusElement.textContent = hasValues ? 
            `Values saved for node ${nodeId}` : 
            `Cleared values for node ${nodeId}`;
        statusElement.className = 'success';
    }
    
    console.log('Node loading/BC values:', nodeLoadingBC);
}

// Update the element selector in the Element Properties section
function updateElementSelector() {
    const elementSelect = document.getElementById('element-selector');
    if (!elementSelect) {
        console.error('Element selector not found');
        return;
    }
    
    elementSelect.innerHTML = '<option value="">Select an element...</option>';
    
    elements.forEach(element => {
        const option = document.createElement('option');
        option.value = element.id;
        
        // Get node positions for better description
        const node1Id = element.nodeIds[0];
        const node2Id = element.nodeIds[1];
        const node1 = nodes.find(n => n.id === node1Id);
        const node2 = nodes.find(n => n.id === node2Id);
        
        if (node1 && node2) {
            option.textContent = `${element.id}: ${node1Id} (${node1.x}, ${node1.y}, ${node1.z}) to ${node2Id} (${node2.x}, ${node2.y}, ${node2.z})`;
        } else {
            option.textContent = `${element.id}: ${node1Id} to ${node2Id}`;
        }
        
        elementSelect.appendChild(option);
    });
}

// Highlight the selected element in the 3D scene
function highlightSelectedElement(elementId) {
    // Reset all element colors first
    Object.entries(elementObjects).forEach(([id, obj]) => {
        // If element has properties, use a different color, otherwise set to default white
        if (elementProperties[id] && Object.keys(elementProperties[id]).length > 0) {
            obj.material.color.set(0x00FF00); // Green for elements with properties
        } else {
            obj.material.color.set(0xFFFFFF); // White for default elements
        }
    });
    
    // Highlight the selected element
    const elementObj = elementObjects[elementId];
    if (elementObj) {
        // Use a bright blue color for the selected element
        elementObj.material.color.set(0x00BFFF); // Deep sky blue
        
        // Make the element slightly thicker to emphasize selection
        const originalGeometry = elementObj.geometry;
        const scale = 1.2;
        
        elementObj.geometry.dispose();
        elementObj.geometry = new THREE.CylinderGeometry(
            CYLINDER_RADIUS * scale, 
            CYLINDER_RADIUS * scale, 
            originalGeometry.parameters.height, 
            8
        );
        
        // Reset thickness of other elements
        Object.entries(elementObjects).forEach(([id, obj]) => {
            if (id !== elementId && obj.userData.type === 'element') {
                const height = obj.geometry.parameters.height;
                obj.geometry.dispose();
                obj.geometry = new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, height, 8);
            }
        });
    }
    
    // Store the selected element
    selectedElement = elementId;
}

// Load existing values for an element into the Element Properties inputs
function loadElementValues(elementId) {
    const values = elementProperties[elementId] || {};
    
    // Clear all inputs first
    ELEMENT_PROPERTY_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.value = '';
        }
    });
    
    // Set existing values
    Object.entries(values).forEach(([field, value]) => {
        const input = document.getElementById(field);
        if (input) {
            if (field === 'local_z' && Array.isArray(value)) {
                // Format the local_z array as a string
                input.value = value.join(',');
            } else {
                input.value = value;
            }
        }
    });
    
    // Highlight the selected element in the 3D scene
    highlightSelectedElement(elementId);
}

// Save Element Properties values for an element
function saveElementValues(elementId) {
    const values = {};
    let hasValues = false;
    
    // Collect non-empty values
    ELEMENT_PROPERTY_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        if (input && input.value !== '') {
            if (field === 'local_z') {
                // Parse the local_z vector from string "x,y,z" to array [x,y,z]
                try {
                    const vectorStr = input.value.trim();
                    const vectorParts = vectorStr.split(',').map(part => parseFloat(part.trim()));
                    
                    if (vectorParts.length === 3 && !vectorParts.some(isNaN)) {
                        values[field] = vectorParts;
                        hasValues = true;
                    } else {
                        console.error('Invalid local_z vector format. Expected "x,y,z"');
                        const statusElement = document.getElementById('element-props-status');
                        if (statusElement) {
                            statusElement.textContent = 'Invalid local_z vector format. Expected "x,y,z"';
                            statusElement.className = 'error';
                        }
                        return; // Exit the function early
                    }
                } catch (error) {
                    console.error('Error parsing local_z vector:', error);
                    const statusElement = document.getElementById('element-props-status');
                    if (statusElement) {
                        statusElement.textContent = 'Error parsing local_z vector. Please use format "x,y,z"';
                        statusElement.className = 'error';
                    }
                    return; // Exit the function early
                }
            } else {
                values[field] = parseFloat(input.value);
                hasValues = true;
            }
        }
    });
    
    if (hasValues) {
        elementProperties[elementId] = values;
        // Update element visualization to indicate it has properties
        if (elementObjects[elementId]) {
            elementObjects[elementId].material.color.set(0x00FF00); // Green color for elements with properties
        }
    } else {
        delete elementProperties[elementId];
        // Reset element color if no properties
        if (elementObjects[elementId]) {
            elementObjects[elementId].material.color.set(0xFFFFFF); // White for default elements
        }
    }
    
    // Update status
    const statusElement = document.getElementById('element-props-status');
    if (statusElement) {
        statusElement.textContent = hasValues ? 
            `Properties saved for element ${elementId}` : 
            `Cleared properties for element ${elementId}`;
        statusElement.className = 'success';
    } else {
        console.log(hasValues ? 
            `Properties saved for element ${elementId}` : 
            `Cleared properties for element ${elementId}`);
    }
    
    console.log('Element properties:', elementProperties);
}

// Clear all nodes and elements
function clearNodes() {
    console.log('Clearing all nodes and elements');
    
    // Remove all nodes and elements from scene
    nodes.forEach(node => {
        scene.remove(nodeObjects[node.id]);
    });
    
    elements.forEach(element => {
        scene.remove(elementObjects[element.id]);
    });
    
    // Clear arrays and objects
    nodes = [];
    elements = [];
    selectedNodes = [];
    nodeObjects = {};
    elementObjects = {};
    originalPositions = {};
    nodeLoadingBC = {};  // Clear loading/BC data
    elementProperties = {};  // Clear element properties
    selectedElement = null;  // Clear selected element
    
    // Update UI
    updateNodeList();
    updateNodeSelector();
    updateElementSelector();
    document.getElementById('add-element-btn').disabled = true;
    
    // Clear Loading/BC inputs
    LOADING_BC_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.value = '';
        }
    });
    
    // Clear Element Properties inputs
    ELEMENT_PROPERTY_FIELDS.forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.value = '';
        }
    });
    
    console.log('All nodes and elements cleared successfully');
}

// Update deformation based on slider value
function updateDeformation(scale) {
    // Apply deformation to all elements
    elements.forEach(element => {
        const cylinder = elementObjects[element.id];
        const originalPos = originalPositions[element.id];
        
        // Get the two nodes for this element
        const node1Id = element.nodeIds[0];
        const node2Id = element.nodeIds[1];
        const node1 = nodeObjects[node1Id];
        const node2 = nodeObjects[node2Id];
        
        // Apply deformation to each node
        for (let i = 0; i < 2; i++) {
            const nodeObj = i === 0 ? node1 : node2;
            const original = originalPos[i];
            
            // Apply a sine wave deformation in the y direction
            const deformation = Math.sin(original.x * Math.PI / 2) * 0.5 * scale;
            
            nodeObj.position.y = original.y + deformation;
        }
        
        // Update cylinder position and orientation
        const newNode1Pos = node1.position;
        const newNode2Pos = node2.position;
        
        // Calculate new distance
        const distance = new THREE.Vector3().subVectors(newNode2Pos, newNode1Pos).length();
        
        // Update cylinder geometry for new length
        cylinder.geometry.dispose();
        cylinder.geometry = new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, distance, 8);
        
        // Position at midpoint
        cylinder.position.copy(newNode1Pos).add(newNode2Pos).multiplyScalar(0.5);
        
        // Orient to point from node1 to node2
        const direction = new THREE.Vector3().subVectors(newNode2Pos, newNode1Pos).normalize();
        
        // Create a quaternion from the direction vector
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        cylinder.quaternion.copy(quaternion);
    });
}

// Reset camera to default position
function resetCamera() {
    console.log('Resetting camera position');
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    controls.reset();
}

// Handle window resize
function onWindowResize() {
    console.log('Window resized, adjusting renderer');
    
    if (!renderer || !camera) {
        console.warn('Cannot resize: renderer or camera not initialized');
        return;
    }
    
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.warn('Cannot resize: container not found');
        return;
    }
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    console.log(`New canvas size: ${width}x${height}`);
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    try {
        if (controls) {
            controls.update();
        }
        
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        } else {
            console.warn('Cannot render: missing renderer, scene, or camera');
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
    }
}

// Tab functionality
function initializeTabs() {
    console.log('Initializing tabs');
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log('Tab clicked:', tab.getAttribute('data-tab'));
            
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const contentId = tab.getAttribute('data-tab');
            const content = document.getElementById(contentId);
            if (content) {
                content.classList.add('active');
                console.log('Activated content:', contentId);
                
                // Reset node and element highlighting when switching tabs
                if (contentId !== 'node-element-type') {
                    resetNodeHighlighting();
                    resetElementHighlighting();
                }
            } else {
                console.error('Content not found for tab:', contentId);
            }
        });
    });

    // Set initial active tab
    if (tabs.length > 0) {
        console.log('Setting initial active tab');
        tabs[0].click();
    }
}

// Reset node highlighting
function resetNodeHighlighting() {
    Object.entries(nodeObjects).forEach(([id, obj]) => {
        // Reset scale
        obj.scale.set(1, 1, 1);
        
        // Reset color based on selection and loading/BC status
        if (selectedNodes.includes(id)) {
            obj.material.color.set(0xff0000); // Red for selected nodes in Geometry tab
        } else if (nodeLoadingBC[id] && Object.keys(nodeLoadingBC[id]).length > 0) {
            obj.material.color.set(0xFFA500); // Orange for nodes with loading/BC
        } else {
            obj.material.color.set(0x4CAF50); // Default green
        }
    });
}

// Reset element highlighting
function resetElementHighlighting() {
    Object.entries(elementObjects).forEach(([id, obj]) => {
        // Reset thickness
        const height = obj.geometry.parameters.height;
        obj.geometry.dispose();
        obj.geometry = new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, height, 8);
        
        // Reset color based on properties
        if (elementProperties[id] && Object.keys(elementProperties[id]).length > 0) {
            obj.material.color.set(0x00FF00); // Green for elements with properties
        } else {
            obj.material.color.set(0xFFFFFF); // Default white
        }
    });
    
    // Clear selected element
    selectedElement = null;
}

// Add a reset button to the UI
function addResetButton() {
    const infoDiv = document.getElementById('info');
    if (infoDiv) {
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset View';
        resetButton.style.marginTop = '10px';
        resetButton.style.padding = '5px 10px';
        resetButton.style.backgroundColor = '#2196F3';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '3px';
        resetButton.style.cursor = 'pointer';
        
        resetButton.addEventListener('click', resetCamera);
        
        infoDiv.appendChild(resetButton);
        console.log('Reset button added to UI');
    }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting application initialization');
    
    // Force a small delay to ensure DOM is fully ready
    setTimeout(() => {
        try {
            initScene();
            initUIHandlers();
            initializeTabs();
            addResetButton();
            animate();
            console.log('Application initialization complete');
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }, 100);
}); 