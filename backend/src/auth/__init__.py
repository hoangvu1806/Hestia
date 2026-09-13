"""Authentication boundary.

Authentication will be implemented later. API handlers currently receive a development user
identity from the shared request dependency, so replacing it with verified auth claims remains
isolated from the agent and service layers.
"""
