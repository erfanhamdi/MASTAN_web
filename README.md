# ME700-Assignment-2 Matrix Structural Analysis code
* This is the code to run the matrix structural analysis for the given problem statement.
* You can find the tutorial notebook in `tutorials.ipynb`
# mastanJ(AX?)
[![python](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
![os](https://img.shields.io/badge/os-ubuntu%20|%20macos%20|%20windows-blue.svg)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/sandialabs/sibl#license)

[![codecov](https://codecov.io/gh/erfanhamdi/mastanJ/graph/badge.svg?token=ZOJJW4Z03P)](https://codecov.io/gh/erfanhamdi/mastanJ)
[![tests](https://github.com/erfanhamdi/mastanJ/actions/workflows/code-coverage.yml/badge.svg)](https://github.com/erfanhamdi/mastanJ/actions)

## Setup instructions
1. Create a conda environment and activate it
```
conda create --name mastanJ-env python=3.9.13
conda activate mastanJ-env
```
2. Clone/Download the code and change directory to it Install the base requirements
```
pip install --upgrade pip setuptools wheel
```
3. Install the requirements by running this command in the root directory.
```
pip install -e .
```
4. You can run the tests using the `pytest` module
```
pytest -v --cov=src  --cov-report term-missing
```
## How to implement your own example?
1. First create a `Frame` object.
```python
F = Frame()
```
2. Create `Node` object for each node and give it `coords = np.array([x, y, z])` coordinates and define the constraints and forces/moments on that node: 
* If it is a free node, then define the loading set `F_x, F_y, F_z, M_x, M_y, M_z`.
* If it is a supported node, then you only have to set the `u_x, u_y, u_z, theta_x, theta_y, theta_z` values to `0`. 
* for example for a fixed node at the origin and a pinned node at (1, 0, 0) and a free node you can define the nodes as follows:
```python
# fixed node
node1 = Node(np.array([0, 0, 0]), u_x=0, u_y=0, u_z=0, theta_x=0, theta_y=0, theta_z=0)
# pinned node
node2 = Node(np.array([1, 0, 0]), u_x=0, u_y=0, u_z=0, M_x = 0, M_y = 0, M_z = 0)
# free node
node3 = Node(np.array([2, 0, 0]), F_x=0, F_y=0, F_z=0, M_x=0, M_y=0, M_z=0)
```
3. Then create `Element` objects and give the nodes and the material properties.
```python
# create an element
element1 = Element(node_list=[node1, node2], E=200, A=10e3, Iy = 10e6, Iz = 10e6, J=10e6, nu = 0.3, local_z = np.array([0,0,1]))
```
4. Add the elements to the frame.
```python
F.add_element([element1, element2, ...])
```
5. Assemble the global stiffness matrix 
```python
F.assemble()
```
6. Solve for the unknown displacements and reactions
```python
delta, F_rxn = F.solve()
```
