import numpy as np
import matplotlib.pyplot as plt

from element import Element
from node import Node


def plot_original(elem_list, fig, discretization_points: int = 100):
    ax = fig.add_subplot(111, projection='3d')
    for elem_ in elem_list:
        x_lin = np.linspace(elem_.node_list[0].coords[0], elem_.node_list[1].coords[0], discretization_points)
        y_lin = np.linspace(elem_.node_list[0].coords[1], elem_.node_list[1].coords[1], discretization_points)
        z_lin = np.linspace(elem_.node_list[0].coords[2], elem_.node_list[1].coords[2], discretization_points)
        ax.plot(x_lin, y_lin, z_lin, '--k', label='Original Shape')
    plt.show()

def plot_deformed(elem_list, shape_function, displacement_vector, scale: float = 1, discretization_points: int = 100):
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    for elem_ in elem_list:
        x_lin = np.linspace(elem_.node_list[0].coords[0], elem_.node_list[1].coords[0], discretization_points)
        y_lin = np.linspace(elem_.node_list[0].coords[1], elem_.node_list[1].coords[1], discretization_points)
        z_lin = np.linspace(elem_.node_list[0].coords[2], elem_.node_list[1].coords[2], discretization_points)
        ax.plot(x_lin, y_lin, z_lin, '--k')
    ax.plot(x_lin, y_lin, z_lin, '--k', label='Original Shape')
    deformed_shape_list = []
    for elem_ in elem_list:
        deformed_shape_array = shape_function.apply(displacement_vector[elem_.dof_list()] * scale, elem_)
        deformed_shape_list.append(deformed_shape_array)
        discretization_points = len(deformed_shape_array)
        ax.scatter(deformed_shape_array[0, 0], deformed_shape_array[0, 1], deformed_shape_array[0, 2], c='r', s=10)
        ax.scatter(deformed_shape_array[-1, 0], deformed_shape_array[-1, 1], deformed_shape_array[-1, 2], c='r', s=10)
        x_lin = np.linspace(deformed_shape_array[0, 0], deformed_shape_array[-1, 0], discretization_points)
        y_lin = np.linspace(deformed_shape_array[0, 1], deformed_shape_array[-1, 1], discretization_points)
        ax.plot(x_lin, y_lin, deformed_shape_array[:, 2],'-b')
    ax.plot(x_lin, y_lin, deformed_shape_array[:, 2],'-b', label='Deformed Shape')
    # plt.scatter(deformed_shape_list[0][0, 0], deformed_shape_list[0][0, 1], deformed_shape_list[0][0, 2], c='r')
    # plt.scatter(deformed_shape_list[1][0, 0], deformed_shape_list[1][0, 1], deformed_shape_list[1][0, 2], c='b')
    # plt.scatter(deformed_shape_list[0][-1, 0], deformed_shape_list[0][-1, 1], deformed_shape_list[0][-1, 2], c='g')
    # plt.scatter(deformed_shape_list[1][-1, 0], deformed_shape_list[1][-1, 1], deformed_shape_list[1][-1, 2], c='y')
    deformed_shape = np.concatenate(deformed_shape_list)
    # ax = fig.add_subplot(111, projection='3d')
    # ax.plot(x_lin, y_lin, deformed_shape[:, 2],'-b', label='Deformed Shape')
    ax.legend()
    ax.set_xlabel('x')
    ax.set_ylabel('y')
    ax.set_zlabel('z')
    plt.show()

class LinearShapeFunctions:
    def __init__(self, elem: Element, discretization_points: int = 100):
        L = elem.L
        self.X_node_1 = elem.node_list[0].coords
        self.X_node_2 = elem.node_list[1].coords
        self.x = np.linspace(self.X_node_1, self.X_node_2, discretization_points)
        self.N1 = 1 - self.x/L
        self.N2 = self.x/L

    def N_vector(self):
        return self.N1 * self.X_node_1 + self.N2 * self.X_node_2

class HermiteShapeFunctions:
    
    def apply(self, displacement_vector: np.ndarray, elem: Element, discretization_points: int = 100):
        X_node_1 = elem.node_list[0].coords
        X_node_1_deformed = X_node_1 + displacement_vector[:3]
        X_node_2 = elem.node_list[1].coords
        X_node_2_deformed = X_node_2 + displacement_vector[6:9]
        theta_node_1 = displacement_vector[3:6]
        theta_node_2 = displacement_vector[9:12]
        # x_old = np.linspace(X_node_1, X_node_2, discretization_points)
        # x_new = np.linspace(X_node_1_deformed, X_node_2_deformed, discretization_points)
        x_new = np.linspace(0, X_node_2_deformed - X_node_1_deformed, discretization_points)
        # L_old = np.array(X_node_2 - X_node_1)
        L_new = np.array(X_node_2_deformed - X_node_1_deformed) + np.array(np.finfo(float).eps)
        N1 = 1 - 3*(x_new/L_new)**2 + 2*(x_new/L_new)**3
        N2 = 3*(x_new/L_new)**2 - 2*(x_new/L_new)**3
        N3 = x_new*(1 - x_new/L_new)**2
        N4 = x_new * ((x_new/L_new)**2 - x_new/L_new)
        deformed_shape = N1 * X_node_1_deformed + N2 * X_node_2_deformed + N3 * theta_node_1 + N4 * theta_node_2
        return deformed_shape