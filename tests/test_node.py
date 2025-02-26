import pytest
import numpy as np
from src.node import Node

# class TestNode:
def test_node_creation_basic():
    # Test with different coordinate input types
    node1 = Node(coords=(0, 0, 0))
    node2 = Node(coords=[0, 0, 0])
    node3 = Node(coords=np.array([0, 0, 0]))

    for node in [node1, node2, node3]:
        assert node.id == 0
        assert all(bc is None for bc in node.bc)
        assert all(load is None for load in node.load)
        assert node.free_dofs == list(range(6))  # All DOFs are free by default
        assert node.fixed_dofs == []

def test_invalid_coords():
    # Test invalid coordinate type
    with pytest.raises(TypeError, match="coords must be a tuple, list or array of 3 numbers"):
        Node(coords="invalid")
        
    # Test invalid coordinate length
    with pytest.raises(ValueError, match="coords must contain exactly 3 values"):
        Node(coords=(1, 2))

def test_invalid_parameters():
    # Test invalid parameter name
    with pytest.raises(ValueError, match="Unknown parameter: invalid_param"):
        Node(coords=(0, 0, 0), invalid_param=42)
        
    # Test invalid boundary condition type
    with pytest.raises(TypeError, match="Boundary condition u_x must be numeric or None"):
        Node(coords=(0, 0, 0), u_x="fixed")
        
    # Test invalid load type
    with pytest.raises(TypeError, match="Load F_x must be numeric or None"):
        Node(coords=(0, 0, 0), F_x="1000N")

def test_node_creation_with_boundary_conditions():
    node = Node(
        coords=np.array([1, 2, 3]),
        u_x=0,
        u_y=0,
        u_z=0,
        theta_x=None,
        theta_y=None,
        theta_z=None
    )
    assert np.array_equal(node.coords, [1, 2, 3])
    assert node.u_x == 0
    assert node.u_y == 0
    assert node.u_z == 0
    assert node.theta_x is None
    assert node.theta_y is None
    assert node.theta_z is None
    assert node.free_dofs == [3, 4, 5]  # Only rotational DOFs are free
    assert node.fixed_dofs == [0, 1, 2]  # Translational DOFs are fixed

def test_node_creation_with_loads():
    node = Node(
        coords=[1, 1, 1],
        F_x=1000,
        F_y=2000,
        M_z=500
    )
    assert np.array_equal(node.coords, [1, 1, 1])
    assert node.F_x == 1000
    assert node.F_y == 2000
    assert node.F_z is None
    assert node.M_x is None
    assert node.M_y is None
    assert node.M_z == 500
    assert len(node.load) == 6

def test_node_dof_identification():
    node = Node(
        coords=(0, 0, 0),
        u_x=0,
        theta_y=0
    )
    assert 0 in node.fixed_dofs  # u_x is fixed
    assert 4 in node.fixed_dofs  # theta_y is fixed
    assert 1 in node.free_dofs   # u_y is free
    assert 2 in node.free_dofs   # u_z is free
    assert 3 in node.free_dofs   # theta_x is free
    assert 5 in node.free_dofs   # theta_z is free
    assert len(node.free_dofs) == 4
    assert len(node.fixed_dofs) == 2

def test_node_boundary_condition_list():
    node = Node(
        coords=(0, 0, 0),
        u_x=0,
        u_y=1,
        theta_z=0.5
    )
    expected_bc = [0, 1, None, None, None, 0.5]
    assert node.bc == expected_bc

def test_node_load_list():
    node = Node(
        coords=(0, 0, 0),
        F_x=100,
        M_y=200
    )
    expected_load = [100, None, None, None, 200, None]
    assert node.load == expected_load

def test_node_mixed_conditions():
    node = Node(
        coords=np.array([1, 2, 3]),
        u_x=0,
        F_y=1000,
        theta_z=0.1,
        M_x=500
    )
    assert node.u_x == 0
    assert node.F_y == 1000
    assert node.theta_z == 0.1
    assert node.M_x == 500
    assert 0 in node.fixed_dofs
    assert 5 in node.fixed_dofs
    assert 1 in node.free_dofs
    assert 2 in node.free_dofs
    assert 3 in node.free_dofs
    assert 4 in node.free_dofs

def test_node_id_assignment():
    node = Node(coords=(0, 0, 0))
    assert node.id == 0  # Assuming default ID is 0
    
    # Test custom ID if that's supported
    node.id = 42
    assert node.id == 42

