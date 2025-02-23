import numpy as np

from frame import Frame
from element import Element
from node import Node
from bc import BC

if __name__ == "__main__":
    # Example 3.2 from the book page 38
    # bc_fixed = BC(u_x = 0, u_y = 0, u_z = 0, theta_x = 0, theta_y = 0, theta_z = 0)
    # bc_roller = BC(F_x = 0, u_y = 0, u_z = 0, theta_x = 0, theta_y = 0, M_z = 0)
    # bc_free = BC(F_x = 500*np.cos(40*np.pi/180), F_y = 500*np.sin(40*np.pi/180), F_z = 0, M_x = 0, M_y = 0, M_z = 0) 
    F = Frame()
    node1 = Node(coords = np.array([0, 0, 0]), F_x = 500*np.cos(40*np.pi/180), F_y = 500*np.sin(40*np.pi/180), F_z = 0, M_x = 0, M_y = 0, M_z = 0) # node a
    node2 = Node(coords = np.array([4, -4, 0]), F_x = 0, u_y = 0, u_z = 0, theta_x = 0, theta_y = 0, theta_z = 0) # node b
    node3 = Node(coords = np.array([-6.928, -4, 0]), u_x = 0, u_y = 0, u_z = 0, theta_x = 0, theta_y = 0, theta_z = 0) # node c
    elem1 = Element(node_list=[node1, node2], A = 20e3, E = 200, Iy = 1, Iz = 1, J = 1)
    elem2 = Element(node_list=[node2, node3], A = 18e3, E = 200, Iy = 1, Iz = 1, J = 1)
    elem3 = Element(node_list=[node1, node3], A = 15e3, E = 200, Iy = 1, Iz = 1, J = 1)
    F.add_elements([elem1, elem2, elem3])
    F.assemble()
    delta, F_rxn = F.solve()
    print(delta)
    print(F_rxn)
    F.plot_deformed(F.dofs_array, scale = 300)
    