import numpy as np
# from src.frame import Frame

class Node:
    def __init__(self, coords, **kwargs):
        # Validate coordinates
        if not isinstance(coords, (tuple, list, np.ndarray)):
            raise TypeError("coords must be a tuple, list or array of 3 numbers")
        if len(coords) != 3:
            raise ValueError("coords must contain exactly 3 values")
        
        self.coords = coords
        self.id = 0

        # Valid parameter names
        valid_params = {'u_x', 'u_y', 'u_z', 'theta_x', 'theta_y', 'theta_z',
                       'F_x', 'F_y', 'F_z', 'M_x', 'M_y', 'M_z'}
        
        # Check for invalid parameters
        invalid_params = set(kwargs.keys()) - valid_params
        if invalid_params:
            raise ValueError(f"Unknown parameter: {invalid_params.pop()}")

        # Initialize and validate boundary conditions and loads
        for param, value in kwargs.items():
            if value is not None and not isinstance(value, (int, float)):
                param_type = "Boundary condition" if param.startswith(('u_', 'theta_')) else "Load"
                raise TypeError(f"{param_type} {param} must be numeric or None")
            setattr(self, param, value)

        # Initialize unset parameters to None
        for param in valid_params:
            if not hasattr(self, param):
                setattr(self, param, None)

        self.bc = [self.u_x, self.u_y, self.u_z, self.theta_x, self.theta_y, self.theta_z]
        self.load = [self.F_x, self.F_y, self.F_z, self.M_x, self.M_y, self.M_z]
        self.free_dofs = [i for i, x in enumerate(self.bc) if x is None]
        self.fixed_dofs = [i for i, x in enumerate(self.bc) if x is not None]