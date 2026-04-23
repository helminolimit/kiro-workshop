from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import CloudFront, APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.compute import Lambda
from diagrams.aws.database import Dynamodb
from diagrams.aws.security import Cognito
from diagrams.aws.general import Users
from diagrams.aws.management import Cloudwatch

with Diagram("Micro Blogging App - High Level Architecture", show=False, direction="LR", filename="micro-blogging-architecture-simple"):
    # User
    user = Users("Users")
    
    # Frontend Layer
    with Cluster("Frontend"):
        cloudfront = CloudFront("CloudFront")
        s3_frontend = S3("S3\n(React SPA)")
        cloudfront - s3_frontend
    
    # API Layer
    with Cluster("API & Auth"):
        api_gateway = APIGateway("API Gateway")
        cognito = Cognito("Cognito\n(Authentication)")
        api_gateway - Edge(style="dashed") - cognito
    
    # Backend Layer
    with Cluster("Backend"):
        lambda_functions = Lambda("Lambda Functions\n(Auth, Posts, Users,\nComments, Monitoring)")
    
    # Monitoring
    cloudwatch = Cloudwatch("CloudWatch\n(Logs & Metrics)")
    
    # Database Layer
    with Cluster("Database"):
        dynamodb = Dynamodb("DynamoDB\n(Users, Posts, Likes,\nComments, Follows)")
    
    # Main flow
    user >> Edge(label="Browse") >> cloudfront
    user >> Edge(label="API Calls") >> api_gateway
    
    api_gateway >> Edge(label="Invoke") >> lambda_functions
    lambda_functions >> Edge(label="Read/Write") >> dynamodb
    lambda_functions >> Edge(label="Logs", style="dotted") >> cloudwatch
    lambda_functions - Edge(label="Auth", style="dashed") - cognito

print("Simple architecture diagram generated successfully!")
