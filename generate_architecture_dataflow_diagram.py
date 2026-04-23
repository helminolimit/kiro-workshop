"""
Micro-Blogging App Architecture Diagram - Data Flow Emphasis

This script generates an AWS architecture diagram with a dark theme
showing the complete data flow from user to database.

Prerequisites:
- Install Graphviz: https://graphviz.org/download/
- Install diagrams: pip install diagrams

Usage:
    python generate_architecture_dataflow_diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.general import Users, User
from diagrams.aws.network import CloudFront, APIGateway
from diagrams.aws.compute import Lambda
from diagrams.aws.security import Cognito
from diagrams.aws.database import DynamodbTable
from diagrams.aws.storage import S3

# Dark theme configuration
graph_attr = {
    "bgcolor": "#1a1a1a",
    "fontcolor": "#ffffff",
    "fontsize": "14",
    "pad": "0.5"
}

node_attr = {
    "fontcolor": "#ffffff",
    "fontsize": "12"
}

edge_attr = {
    "color": "#00d4ff",
    "fontcolor": "#ffffff",
    "fontsize": "10"
}

cluster_attr = {
    "bgcolor": "#2d2d2d",
    "fontcolor": "#ffffff",
    "pencolor": "#00d4ff"
}

with Diagram(
    "Micro-Blogging App - Data Flow Architecture",
    direction="LR",
    show=False,
    filename="architecture-dataflow-diagram",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr
):
    # Users
    users = Users("Users")
    
    # Frontend hosting
    with Cluster("Frontend Hosting", graph_attr=cluster_attr):
        s3_bucket = S3("S3 Bucket\n(React SPA)")
        cloudfront = CloudFront("CloudFront\nCDN")
        s3_bucket - cloudfront
    
    # Authentication
    with Cluster("Authentication", graph_attr=cluster_attr):
        cognito = Cognito("Cognito\nUser Pool")
    
    # API Layer
    with Cluster("API Layer", graph_attr=cluster_attr):
        api_gateway = APIGateway("API Gateway\nREST API")
    
    # Backend Functions
    with Cluster("Backend Lambda Functions", graph_attr=cluster_attr):
        auth_lambda = Lambda("Auth\n(login/register)")
        posts_lambda = Lambda("Posts\n(create/get/like)")
        users_lambda = Lambda("Users\n(profile/follow)")
        comments_lambda = Lambda("Comments\n(create/get/delete)")
    
    # Database Layer
    with Cluster("Database Layer (DynamoDB)", graph_attr=cluster_attr):
        users_table = DynamodbTable("Users Table")
        posts_table = DynamodbTable("Posts Table")
        likes_table = DynamodbTable("Likes Table")
        comments_table = DynamodbTable("Comments Table")
        follows_table = DynamodbTable("Follows Table")
    
    # Data flow - User to Frontend
    users >> Edge(label="1. Access app", color="#00ff88") >> cloudfront
    cloudfront >> Edge(label="2. Serve SPA", color="#00ff88") >> users
    
    # Data flow - Authentication
    users >> Edge(label="3. Login/Register", color="#ffaa00") >> api_gateway
    api_gateway >> Edge(label="4. Route request", color="#ffaa00") >> auth_lambda
    auth_lambda >> Edge(label="5. Validate", color="#ffaa00") >> cognito
    cognito >> Edge(label="6. JWT tokens", color="#ffaa00") >> auth_lambda
    auth_lambda >> Edge(label="7. User data", color="#ffaa00") >> users_table
    
    # Data flow - Posts
    users >> Edge(label="8. Create/View posts", color="#00d4ff") >> api_gateway
    api_gateway >> Edge(label="9. Invoke", color="#00d4ff") >> posts_lambda
    posts_lambda >> Edge(label="10. Write/Read", color="#00d4ff") >> posts_table
    posts_lambda >> Edge(label="11. Like data", color="#00d4ff") >> likes_table
    
    # Data flow - Users & Social
    users >> Edge(label="12. Profile/Follow", color="#ff00ff") >> api_gateway
    api_gateway >> Edge(label="13. Invoke", color="#ff00ff") >> users_lambda
    users_lambda >> Edge(label="14. User data", color="#ff00ff") >> users_table
    users_lambda >> Edge(label="15. Follow data", color="#ff00ff") >> follows_table
    
    # Data flow - Comments
    users >> Edge(label="16. Comments", color="#ffff00") >> api_gateway
    api_gateway >> Edge(label="17. Invoke", color="#ffff00") >> comments_lambda
    comments_lambda >> Edge(label="18. Comment data", color="#ffff00") >> comments_table

print("✓ Architecture data flow diagram generated: architecture-dataflow-diagram.png")
print("  - Dark theme enabled")
print("  - Horizontal layout (left to right)")
print("  - Color-coded data flows:")
print("    • Green: Frontend access")
print("    • Orange: Authentication flow")
print("    • Cyan: Posts & likes flow")
print("    • Magenta: Users & follows flow")
print("    • Yellow: Comments flow")
