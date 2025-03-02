#!/usr/bin/env python3
"""
Server script for processing 3D structure data from the visualization application.
This script receives node and element data, performs calculations, and returns results.
"""

import json
import os
import sys
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS


from src.frame import Frame
from src.element import Element
from src.node import Node
from src.shape_functions import plot_original, plot_deformed, LinearShapeFunctions, HermiteShapeFunctions


app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Serve static files from the visualization directory
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('visualization', path)

@app.route('/calculate', methods=['POST'])
def calculate():
    """
    Receive node and element data, perform calculations, and return results.
    
    Expected JSON format:
    {
        "nodes": [
            {"id": "node-0", "x": 0, "y": 0, "z": 0, "loadingBC": {...}},
            {"id": "node-1", "x": 1, "y": 0, "z": 0, "loadingBC": {...}},
            ...
        ],
        "elements": [
            {"id": "element-0", "nodeIds": ["node-0", "node-1"], "properties": {...}},
            ...
        ],
        "deformationScale": 50  // Optional parameter for deformation scale
    }
    """
    try:
        # Get data from request
        data = request.json
        
        if not data or 'nodes' not in data:
            return jsonify({'error': 'Invalid data format. Nodes are required.'}), 400
        
        # Extract node data
        nodes = data['nodes']
        elements = data.get('elements', [])
        deformation_scale = data.get('deformationScale', 10)  # Default to 10 if not provided
        
        # Log received data
        print(f"Received {len(nodes)} nodes and {len(elements)} elements with deformation scale {deformation_scale}")
        
        # Create Node objects from user data
        node_objects = []
        node_dict = {}  # Dictionary to store nodes by their IDs
        for node in nodes:
            coords = np.array([node['x'], node['y'], node['z']])
            node_id = int(node['id'].split('-')[1])
            
            # Get loading/BC data if it exists
            loading_bc = node.get('loadingBC', {})
            
            # Create Node object with loading/BC parameters
            node_obj = Node(
                coords=coords,
                **{k: v for k, v in loading_bc.items() if v is not None}  # Only include non-None values
            )
            node_obj.id = node_id
            node_objects.append(node_obj)
            node_dict[node['id']] = node_obj
        
        # Perform calculations (example: calculate centroid)
        results = perform_calculations(nodes, elements, deformation_scale)
        
        # Return results
        return jsonify({
            'status': 'success',
            'message': 'Calculations completed successfully',
            'results': results
        })
        
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        return jsonify({'error': str(e)}), 500

def perform_calculations(nodes, elements, deformation_scale=10):
    """
    Perform calculations on the node and element data.
    This is where you would implement your specific calculations.
    
    Args:
        nodes: List of node objects with id, x, y, z properties
        elements: List of element objects with id and nodeIds properties
        deformation_scale: Scale factor for deformation visualization
        
    Returns:
        Dictionary of calculation results
    """
    # Example calculation: Find centroid of all nodes
    if not nodes:
        return {'error': 'No nodes to calculate'}
    
    # Create Node objects
    node_objects = []
    node_dict = {}  # Dictionary to store nodes by their IDs
    for node in nodes:
        coords = np.array([node['x'], node['y'], node['z']])
        node_id = int(node['id'].split('-')[1])
        
        # Get loading/BC data if it exists
        loading_bc = node.get('loadingBC', {})
        
        # Create Node object with loading/BC parameters
        node_obj = Node(
            coords=coords,
            **{k: v for k, v in loading_bc.items() if v is not None}  # Only include non-None values
        )
        node_obj.id = node_id
        node_objects.append(node_obj)
        node_dict[node['id']] = node_obj
    
    # Create Element objects
    element_objects = []
    for element in elements:
        # Get the Node objects for this element
        node_ids = element['nodeIds']
        if len(node_ids) == 2:
            node1 = node_dict.get(node_ids[0])
            node2 = node_dict.get(node_ids[1])
            
            if node1 and node2:
                # Get element properties if they exist
                properties = element.get('properties', {})
                
                # Default values for element properties
                default_props = {
                    'E': 1000,    # Default elastic modulus
                    'A': 0.5,    # Default cross-sectional area
                    'Iy': 1 * 0.5**3/12,   # Default moment of inertia about y-axis
                    'Iz': 0.5*1**3/12,   # Default moment of inertia about z-axis
                    'J': 0.02861,    # Default torsional constant
                    'nu': 0.3,   # Default Poisson's ratio
                    'local_z': None  # Default local z-axis direction
                }
                
                # Update defaults with user-provided values
                for prop, value in properties.items():
                    if prop in default_props:
                        default_props[prop] = value
                
                # Create Element object with properties
                element_obj = Element(
                    node_list=[node1, node2],
                    E=default_props['E'],
                    A=default_props['A'],
                    Iy=default_props['Iy'],
                    Iz=default_props['Iz'],
                    J=default_props['J'],
                    nu=default_props['nu']
                )
                
                # Set local_z if provided
                if 'local_z' in default_props and default_props['local_z']:
                    try:
                        local_z = np.array(default_props['local_z'])
                        # Normalize the vector
                        local_z = local_z / np.linalg.norm(local_z)
                        element_obj.local_z = local_z
                        print(f"Set local_z for element: {local_z}")
                    except Exception as e:
                        print(f"Error setting local_z: {e}")
                
                element_objects.append(element_obj)
                
                # Log element properties
                print(f"Created element with properties: E={default_props['E']}, A={default_props['A']}, " +
                      f"Iy={default_props['Iy']}, Iz={default_props['Iz']}, J={default_props['J']}, nu={default_props['nu']}, " +
                      f"local_z={default_props['local_z']}")
    
    # Try to solve the frame if we have elements
    delta = None
    F_rxn = None
    if element_objects:
        try:
            F = Frame()
            F.add_elements(element_objects)
            F.assemble()
            delta, F_rxn = F.solve()
            print(f"Delta:\n {delta}")
            print(f"Reaction force on supports:\n {F_rxn}")
            hermite_sf = HermiteShapeFunctions()
            deformed_shape_list = []
            # Use the provided deformation scale
            scale = deformation_scale
            for elem_ in element_objects:
                deformed_shape_array = hermite_sf.apply(delta[elem_.dof_list()] * scale, elem_)
                deformed_shape_list.append(deformed_shape_array)

            # Convert deformed shape data to a format suitable for JSON
            deformed_shapes = []
            deformed_nodes = []
            for i, deformed_shape in enumerate(deformed_shape_list):
                # Convert numpy array to list for JSON serialization
                deformed_nodes.append(deformed_shape[0].tolist())
                deformed_nodes.append(deformed_shape[-1].tolist())
                shape_data = deformed_shape.tolist() if hasattr(deformed_shape, 'tolist') else deformed_shape
                deformed_shapes.append({
                    'element_index': i,
                    'shape_data': shape_data,
                    'deformed_nodes': deformed_nodes
                })
            
            # Don't plot on server-side to avoid GUI issues
            # plot_deformed(element_objects, hermite_sf, delta, scale=10)

        except Exception as e:
            print(f"Error solving frame: {str(e)}")
    
    # Format delta and F_rxn for display
    formatted_results = {}
    
    # Format displacements/rotations (delta)
    if delta is not None:
        try:
            # Convert numpy array to list for JSON serialization
            delta_list = delta.tolist() if hasattr(delta, 'tolist') else delta
            
            # Format delta into a more readable structure
            formatted_delta = []
            for i, value in enumerate(delta_list):
                node_index = i // 6  # Each node has 6 DOFs
                dof_index = i % 6
                
                # Map DOF index to name
                dof_names = ['u_x', 'u_y', 'u_z', 'θ_x', 'θ_y', 'θ_z']
                dof_name = dof_names[dof_index]
                
                formatted_delta.append({
                    'node': node_index,
                    'dof': dof_name,
                    'value': value
                })
            
            formatted_results['displacements'] = formatted_delta
        except Exception as e:
            print(f"Error formatting delta: {e}")
            formatted_results['displacements'] = "Error formatting displacements"
    
    # Format reaction forces (F_rxn)
    if F_rxn is not None:
        try:
            # Convert numpy array to list for JSON serialization
            rxn_list = F_rxn.tolist() if hasattr(F_rxn, 'tolist') else F_rxn
            
            # Format F_rxn into a more readable structure
            formatted_rxn = []
            for i, value in enumerate(rxn_list):
                node_index = i // 6  # Each node has 6 DOFs
                dof_index = i % 6
                
                # Map DOF index to name
                dof_names = ['F_x', 'F_y', 'F_z', 'M_x', 'M_y', 'M_z']
                dof_name = dof_names[dof_index]
                
                formatted_rxn.append({
                    'node': node_index,
                    'dof': dof_name,
                    'value': value
                })
            
            formatted_results['reactions'] = formatted_rxn
        except Exception as e:
            print(f"Error formatting F_rxn: {e}")
            formatted_results['reactions'] = "Error formatting reactions"
    
    # Return calculation results
    return {
        'analysis_results': formatted_results,
        'node_count': len(nodes),
        'element_count': len(elements),
        'deformed_shapes': deformed_shapes if 'deformed_shapes' in locals() else None
    }

if __name__ == '__main__':
    # Determine the port to use (default: 8000)
    port = int(os.environ.get('PORT', 8000))
    
    print(f"Starting server on port {port}...")
    print(f"Access the application at: http://localhost:{port}/")
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=port, debug=True) 