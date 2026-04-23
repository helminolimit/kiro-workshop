from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import CloudFront, APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.compute import Lambda
from diagrams.aws.database import DynamodbTable
from diagrams.aws.security import Cognito
from diagrams.aws.general import Users
from diagrams.aws.management import Cloudwatch, CloudwatchLogs

with Diagram("Micro Blogging App Architecture - Detailed", show=False, direction="LR", filename="micro-blogging-architecture-detailed"):
    # User
    user = Users("Users")
    
    # Frontend Layer
    with Cluster("Frontend Layer"):
        cloudfront = CloudFront("CloudFront\nDistribution")
        s3_frontend = S3("S3 Bucket\n(React SPA)")
        cloudfront >> s3_frontend
    
    # API Layer
    with Cluster("API Layer"):
        api_gateway = APIGateway("API Gateway\nREST API")
        cognito = Cognito("Cognito\nUser Pool\n(JWT Auth)")
    
    # Backend Layer - Auth Functions
    with Cluster("Auth Functions"):
        lambda_login = Lambda("login.js\n(POST /auth/login)")
        lambda_register = Lambda("register.js\n(POST /auth/register)")
    
    # Backend Layer - Posts Functions
    with Cluster("Posts Functions"):
        lambda_create_post = Lambda("createPost.js\n(POST /posts)")
        lambda_get_posts = Lambda("getPosts.js\n(GET /posts)")
        lambda_like_post = Lambda("likePost.js\n(POST /posts/:id/like)")
    
    # Backend Layer - Users Functions
    with Cluster("Users Functions"):
        lambda_get_profile = Lambda("getProfile.js\n(GET /users/:id)")
        lambda_update_profile = Lambda("updateProfile.js\n(PUT /users/:id)")
        lambda_follow = Lambda("followUser.js\n(POST /users/:id/follow)")
        lambda_unfollow = Lambda("unfollowUser.js\n(DELETE /users/:id/follow)")
        lambda_check_following = Lambda("checkFollowing.js\n(GET /users/:id/following)")
    
    # Backend Layer - Comments Functions
    with Cluster("Comments Functions"):
        lambda_create_comment = Lambda("createComment.js\n(POST /posts/:id/comments)")
        lambda_get_comments = Lambda("getComments.js\n(GET /posts/:id/comments)")
        lambda_delete_comment = Lambda("deleteComment.js\n(DELETE /comments/:id)")
    
    # Backend Layer - Monitoring
    lambda_monitoring = Lambda("emitCustomMetrics.js\n(CloudWatch Metrics)")
    
    # Monitoring & Logging
    with Cluster("Monitoring & Logging"):
        cloudwatch = Cloudwatch("CloudWatch\nMetrics")
        cloudwatch_logs = CloudwatchLogs("CloudWatch\nLogs")
    
    # Database Layer
    with Cluster("DynamoDB Tables (On-Demand)"):
        db_users = DynamodbTable("Users\n(PK: userId)\nGSI: username-index")
        db_posts = DynamodbTable("Posts\n(PK: postId)\nGSI: userId-index")
        db_likes = DynamodbTable("Likes\n(PK: likeId)\nGSI: postId-userId")
        db_comments = DynamodbTable("Comments\n(PK: commentId)\nGSI: postId-index")
        db_follows = DynamodbTable("Follows\n(PK: followId)\nGSI: follower-following")
    
    # User flow
    user >> cloudfront
    user >> Edge(label="HTTPS") >> api_gateway
    
    # API Gateway to Auth
    api_gateway >> Edge(label="/auth/login") >> lambda_login
    api_gateway >> Edge(label="/auth/register") >> lambda_register
    
    # API Gateway to Posts
    api_gateway >> Edge(label="/posts (POST)") >> lambda_create_post
    api_gateway >> Edge(label="/posts (GET)") >> lambda_get_posts
    api_gateway >> Edge(label="/posts/:id/like") >> lambda_like_post
    
    # API Gateway to Users
    api_gateway >> Edge(label="/users/:id (GET)") >> lambda_get_profile
    api_gateway >> Edge(label="/users/:id (PUT)") >> lambda_update_profile
    api_gateway >> Edge(label="/users/:id/follow") >> lambda_follow
    api_gateway >> Edge(label="/users/:id/unfollow") >> lambda_unfollow
    api_gateway >> Edge(label="/users/:id/following") >> lambda_check_following
    
    # API Gateway to Comments
    api_gateway >> Edge(label="/posts/:id/comments (POST)") >> lambda_create_comment
    api_gateway >> Edge(label="/posts/:id/comments (GET)") >> lambda_get_comments
    api_gateway >> Edge(label="/comments/:id (DELETE)") >> lambda_delete_comment
    
    # Auth flow
    lambda_login >> Edge(label="Authenticate") >> cognito
    lambda_register >> Edge(label="Create User") >> cognito
    api_gateway >> Edge(label="Validate JWT", style="dashed", color="orange") >> cognito
    
    # Auth Lambda to DynamoDB
    lambda_login >> Edge(label="Read") >> db_users
    lambda_register >> Edge(label="Write") >> db_users
    
    # Posts Lambda to DynamoDB
    lambda_create_post >> Edge(label="Write") >> db_posts
    lambda_get_posts >> Edge(label="Read") >> db_posts
    lambda_like_post >> Edge(label="Write") >> db_likes
    lambda_like_post >> Edge(label="Update count") >> db_posts
    
    # Users Lambda to DynamoDB
    lambda_get_profile >> Edge(label="Read") >> db_users
    lambda_update_profile >> Edge(label="Update") >> db_users
    lambda_follow >> Edge(label="Write") >> db_follows
    lambda_follow >> Edge(label="Update count") >> db_users
    lambda_unfollow >> Edge(label="Delete") >> db_follows
    lambda_unfollow >> Edge(label="Update count") >> db_users
    lambda_check_following >> Edge(label="Read") >> db_follows
    
    # Comments Lambda to DynamoDB
    lambda_create_comment >> Edge(label="Write") >> db_comments
    lambda_get_comments >> Edge(label="Read") >> db_comments
    lambda_delete_comment >> Edge(label="Delete") >> db_comments
    
    # CloudWatch Monitoring - All Lambda functions send logs and metrics
    lambda_login >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_register >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_create_post >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_get_posts >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_like_post >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_get_profile >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_update_profile >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_follow >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_unfollow >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_check_following >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_create_comment >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_get_comments >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    lambda_delete_comment >> Edge(label="Logs", style="dotted", color="blue") >> cloudwatch_logs
    
    # Custom metrics from monitoring Lambda
    lambda_monitoring >> Edge(label="Custom Metrics", color="purple") >> cloudwatch

print("Detailed architecture diagram generated successfully!")
