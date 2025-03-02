import numpy as np
import scipy
import matplotlib.pyplot as plt

class Frame:
    def __init__(self):
            self.elems = []
            self.nodes = []
            self.free_dofs = []
            self.fixed_dofs = []
            self.K = None
            self.F = None
            self.Delta = None
            self.number_of_dofs = 0
            self.K_ff = None
            self.K_fs = None
            self.K_sf = None
            self.K_ss = None
            self.dofs_array = None
            self.Delta_f = None

    def add_elements(self, elems):
        self.elems = elems
        self.nodes = []
        for elem_id, elem in enumerate(elems):
            elem.id = elem_id
            for node in elem.node_list:
                if node not in self.nodes:
                    self.nodes.append(node)
        for node_id, node in enumerate(self.nodes):
            node.id = node_id
        self.number_of_dofs = self.num_dofs()
        for elem in self.elems:
            elem.element_dof_list_ = self.element_dof_list(elem)


    def element_dof_list(self, elem):
            return [*list(range(elem.node_list[0].id*6, elem.node_list[0].id*6 + 6)), *list(range(elem.node_list[1].id*6, elem.node_list[1].id*6 + 6))]

    def num_dofs(self):
        node_dict = {}
        for node in self.nodes:
            node_dict[node.id] = 1
        return 6 * len(node_dict)
    
    def assemble(self):
        self.K = np.zeros((self.number_of_dofs, self.number_of_dofs))
        self.F = np.zeros((self.number_of_dofs))
        self.Delta = np.zeros((self.number_of_dofs))
        for i, elem in enumerate(self.elems):
            small_K = elem.global_stiffness_mat()
            node_1_id = elem.node_list[0].id
            node_2_id = elem.node_list[1].id
            self.K[6*node_1_id:6*(node_1_id+1), 6*node_1_id:6*(node_1_id+1)] += small_K[:6, :6]
            self.K[6*node_1_id:6*(node_1_id+1), 6*node_2_id:6*(node_2_id+1)] += small_K[:6, 6:]
            self.K[6*node_2_id:6*(node_2_id+1), 6*node_1_id:6*(node_1_id+1)] += small_K[6:, :6]
            self.K[6*node_2_id:6*(node_2_id+1), 6*node_2_id:6*(node_2_id+1)] += small_K[6:, 6:]
        self.partition()
            
    def partition(self,):
        f_list = []
        for node in self.nodes:
            self.free_dofs += [i + 6*node.id for i in node.free_dofs]
            self.fixed_dofs += [i + 6*node.id for i in node.fixed_dofs]
            f_list += node.load
        self.K_ff = self.K[np.ix_(self.free_dofs, self.free_dofs)]
        self.K_fs = self.K[np.ix_(self.free_dofs, self.fixed_dofs)]
        self.K_sf = self.K[np.ix_(self.fixed_dofs, self.free_dofs)]
        self.K_ss = self.K[np.ix_(self.fixed_dofs, self.fixed_dofs)]
        self.F[self.free_dofs] = np.array(f_list)[self.free_dofs]
    
    def solve(self,):
        self.Delta[self.free_dofs] = np.linalg.inv(self.K_ff) @ self.F[self.free_dofs]
        self.F[self.fixed_dofs] = self.K_sf @ self.Delta[self.free_dofs] 
        return self.Delta, self.F
    
    def assemble_geometric(self,):
        self.K_g = np.zeros((self.number_of_dofs, self.number_of_dofs))
        for i, elem in enumerate(self.elems):
            small_K_g = elem.global_geometric_stiffness_mat(elem.k_g)
            node_1_id = elem.node_list[0].id
            node_2_id = elem.node_list[1].id
            self.K_g[6*node_1_id:6*(node_1_id+1), 6*node_1_id:6*(node_1_id+1)] += small_K_g[:6, :6]
            self.K_g[6*node_1_id:6*(node_1_id+1), 6*node_2_id:6*(node_2_id+1)] += small_K_g[:6, 6:]
            self.K_g[6*node_2_id:6*(node_2_id+1), 6*node_1_id:6*(node_1_id+1)] += small_K_g[6:, :6]
            self.K_g[6*node_2_id:6*(node_2_id+1), 6*node_2_id:6*(node_2_id+1)] += small_K_g[6:, 6:]
        
    def eigenvalue_analysis(self,):
        eig_val, eig_vec = scipy.linalg.eig(self.K, -self.K_g)
        return eig_val, eig_vec


    # def plot_initial(self,):
    #     plt.figure()
    #     for node in self.nodes:
    #         plt.scatter(node.coords[0], node.coords[1], color='red')
    #     for elem in self.elems:
    #         x = [elem.node_list[0].coords[0], elem.node_list[1].coords[0]]
    #         y = [elem.node_list[0].coords[1], elem.node_list[1].coords[1]]
    #         plt.plot(x, y, color='black')
    #     plt.plot(x, y, color='black', label = f"Initial state")
    
    # def plot_deformed(self, dofs_array_deformed, scale = 10):
    #     self.plot_initial()
    #     dofs_array_deformed[self.free_dofs] = self.dofs_array[self.free_dofs] + self.Delta_f * scale
    #     x = dofs_array_deformed[0::6]
    #     y = dofs_array_deformed[1::6]
    #     plt.scatter(x, y, color='red')
    #     for i, elem in enumerate(self.elems):
    #         x = [dofs_array_deformed[6*elem.node_list[0].id], dofs_array_deformed[6*elem.node_list[1].id]]
    #         y = [dofs_array_deformed[6*elem.node_list[0].id+1], dofs_array_deformed[6*elem.node_list[1].id+1]]
    #         plt.plot(x, y, 'k--')
    #     plt.legend()
    #     plt.plot(x, y, 'k--', label = f"Deformed (scale = {scale}")
        