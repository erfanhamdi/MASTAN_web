import numpy
from frame import Frame
from math_utils import local_elastic_stiffness_matrix_3D_beam, rotation_matrix_3D, transformation_matrix_3D, local_geometric_stiffness_matrix_3D_beam

class Element(Frame):
    def __init__(self, node_list, **kwargs):
        self.node_list = node_list
        self.coord_list = [node_list[0].coords[0], node_list[0].coords[1], node_list[0].coords[2], node_list[1].coords[0], node_list[1].coords[1], node_list[1].coords[2]]
        self.local_z = kwargs.get('local_z', None)
        
        self.E = kwargs.get('E', 1.0)

        self.A = kwargs.get('A', 1.0)
    
        self.L = numpy.linalg.norm(node_list[1].coords - node_list[0].coords)
        
        self.Iy = kwargs.get('Iy', 1.0)

        self.Iz = kwargs.get('Iz', 1.0)

        self.I_rho = kwargs.get('I_rho', 1.0)
        
        self.J = kwargs.get('J', 1.0)
    
        self.nu = kwargs.get('nu', 0.3)

        self.element_dof_list_ = []
    def __repr__(self):
        # prints the element's properties
        return f"Element id: (E={self.E}), A={self.A}, L={self.L}, Iy={self.Iy}, Iz={self.Iz}, J={self.J}, nu={self.nu}"
    
    def dof_list(self,):
        return [*list(range(self.node_list[0].id*6, self.node_list[0].id*6 + 6)), *list(range(self.node_list[1].id*6, self.node_list[1].id*6 + 6))]
    
    def stiffness_mat(self,):
        return local_elastic_stiffness_matrix_3D_beam(self.E, self.nu, self.A, self.L, self.Iy, self.Iz, self.J)
    
    def geometric_stiffness_mat(self,F):
        """Fx2, Mx2, My1, Mz1, My2, Mz2"""
        F = self.Gamma().T @ F
        F_list = [F[6], F[9], F[4], F[5], F[10], F[11]]
        self.k_g = local_geometric_stiffness_matrix_3D_beam(self.L, self.A, self.I_rho, *F_list)
    
    def global_geometric_stiffness_mat(self, small_k_g):
            return self.Gamma().T @ small_k_g @ self.Gamma()
    
    def Gamma(self,):
        gamma = rotation_matrix_3D(v_temp=self.local_z, *self.coord_list)
        return transformation_matrix_3D(gamma)
    
    def global_stiffness_mat(self,):
        return self.Gamma().T @ self.stiffness_mat() @ self.Gamma()
    
    def internal_force(self, delta):
         return self.global_stiffness_mat() @ delta[self.element_dof_list_]

# Example usage:

# Case 1: User defines a shared variable in Frame
# Frame.set_cross_section(E = 100, A = 200, L = 300, I = 400)
# elem1 = Element(E = 10)
# print(elem1)  # Output: Element(variable=100)
# Case 2: The shared variable is not set, so each Element gets its own value
# Frame.shared_value = None  # Unset the shared variable
# elem3 = Element(E = 30)
# elem4 = Element(A = 40)
# elem5 = Element(L = 50, id = 5)
# print(elem3)  # Output: Element(variable=30)
# print(elem4)  
# print(elem5)  # Output: Element(variable=50)