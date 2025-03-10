# 3D Structure Visualization

A web-based 3D visualization tool for creating and analyzing structural elements.

## Features

- Create nodes in 3D space
- Connect nodes to form elements
- Apply deformation to the structure
- Send node data to a Python server for calculations
- Visualize the structure in 3D with interactive controls

## Setup and Installation

### Prerequisites

- Python 3.6 or higher
- Web browser (Chrome, Firefox, or Edge recommended)

### Installation

1. Clone this repository or download the files
2. Install the required Python packages:

```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the Python server:

```bash
python server.py
```

2. Open your web browser and navigate to:

```
http://localhost:8000/
```

## Usage

### Adding Nodes

1. Enter X, Y, Z coordinates in the input fields
2. Click "Add Node"
3. The node will appear in the 3D view and in the node list

### Creating Elements

1. Select two nodes from the node list (they will turn red when selected)
2. Click "Create Element"
3. The element (line) will appear connecting the two nodes

### Applying Deformation

1. Use the "Deformation Scale" slider to adjust the deformation amount
2. The structure will deform based on a sine wave pattern

### Performing Calculations

1. Create your structure with nodes and elements
2. Click the "Calculate" button
3. The node data will be sent to the Python server for processing
4. Results will be displayed in the calculation status area

### 3D Navigation

- Click and drag to rotate the view
- Scroll to zoom in/out
- Click "Reset Camera" to return to the default view

## Customization

You can modify the `perform_calculations` function in `server.py` to implement your own specific calculations based on the node and element data.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
