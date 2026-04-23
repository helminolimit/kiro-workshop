"""
Login Flow Sequence Diagram Generator

This script generates a sequence diagram showing the authentication flow
for the Micro Blogging App.

Prerequisites:
- Install Graphviz: https://graphviz.org/download/
- Install diagrams: pip install diagrams

Usage:
    python generate_login_sequence_diagram.py
"""

from diagrams import Diagram, Edge
from diagrams.aws.general import User
from diagrams.aws.network import APIGateway
from diagrams.aws.compute import Lambda
from diagrams.aws.security import Cognito

with Diagram("Login Flow with Error Handling - Micro Blogging App", direction="LR", show=False, filename="login-sequence-diagram"):
    # Define the components
    user = User("User")
    react_app = Lambda("React App\n(Frontend)")
    api_gateway = APIGateway("API Gateway")
    auth_lambda = Lambda("Auth Lambda\n(login.js)")
    cognito = Cognito("Cognito\nUser Pool")
    
    # Define the happy path flow
    user >> Edge(label="1. Enter credentials") >> react_app
    react_app >> Edge(label="2. POST /auth/login") >> api_gateway
    api_gateway >> Edge(label="3. Invoke") >> auth_lambda
    auth_lambda >> Edge(label="4. Validate credentials") >> cognito
    
    # Success path
    cognito >> Edge(label="5a. SUCCESS\nReturn tokens\n(IdToken, AccessToken)", color="green") >> auth_lambda
    auth_lambda >> Edge(label="6a. 200 OK\nReturn tokens", color="green") >> api_gateway
    api_gateway >> Edge(label="7a. Return tokens", color="green") >> react_app
    react_app >> Edge(label="8a. Store tokens\n& redirect to feed", color="green") >> user
    
    # Error path
    cognito >> Edge(label="5b. FAILURE\nInvalid credentials", color="red", style="dashed") >> auth_lambda
    auth_lambda >> Edge(label="6b. 401 Unauthorized\nError message", color="red", style="dashed") >> api_gateway
    api_gateway >> Edge(label="7b. Return error", color="red", style="dashed") >> react_app
    react_app >> Edge(label="8b. Display error\nStay on login page", color="red", style="dashed") >> user

print("✓ Login sequence diagram generated: login-sequence-diagram.png")
