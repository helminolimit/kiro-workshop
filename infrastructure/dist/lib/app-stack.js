"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const path = require('path');
class AppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Helper function to get Lambda package path
        const getLambdaPackagePath = (functionName) => {
            return path.join(__dirname, '../../backend/dist/lambda-packages', `${functionName}.zip`);
        };
        // Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            standardAttributes: {
                email: { required: true, mutable: true },
                preferredUsername: { required: true, mutable: true }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // User Pool Client
        this.userPoolClient = this.userPool.addClient('UserPoolClient', {
            authFlows: {
                userPassword: true,
                userSrp: true,
                adminUserPassword: true // Enable ADMIN_USER_PASSWORD_AUTH flow
            },
            preventUserExistenceErrors: true
        });
        // Identity Pool
        this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [{
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName
                }]
        });
        // IAM Roles for authenticated and unauthenticated users
        const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': this.identityPool.ref
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated'
                }
            }, 'sts:AssumeRoleWithWebIdentity')
        });
        // Attach role to identity pool
        new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn
            }
        });
        // DynamoDB Users Table
        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for username lookups
        this.usersTable.addGlobalSecondaryIndex({
            indexName: 'username-index',
            partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Posts Table
        this.postsTable = new dynamodb.Table(this, 'PostsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for user's posts
        this.postsTable.addGlobalSecondaryIndex({
            indexName: 'userId-index',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Likes Table
        this.likesTable = new dynamodb.Table(this, 'LikesTable', {
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for post's likes
        this.likesTable.addGlobalSecondaryIndex({
            indexName: 'postId-index',
            partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Comments Table
        this.commentsTable = new dynamodb.Table(this, 'CommentsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for post's comments
        this.commentsTable.addGlobalSecondaryIndex({
            indexName: 'postId-index',
            partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // DynamoDB Follows Table
        this.followsTable = new dynamodb.Table(this, 'FollowsTable', {
            partitionKey: { name: 'followerId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'followeeId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY // For development only
        });
        // Add GSI for followee's followers
        this.followsTable.addGlobalSecondaryIndex({
            indexName: 'followee-index',
            partitionKey: { name: 'followeeId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'followerId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // API Gateway
        this.api = new apigateway.RestApi(this, 'MicroBloggingApi', {
            restApiName: 'Micro Blogging API',
            description: 'API for Micro Blogging application',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
                allowCredentials: true
            }
        });
        // Lambda function for registration
        const registerFunction = new lambda.Function(this, 'RegisterFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'register.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('register')),
            environment: {
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for login
        const loginFunction = new lambda.Function(this, 'LoginFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'login.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('login')),
            environment: {
                USER_POOL_ID: this.userPool.userPoolId,
                USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting user profile
        const getProfileFunction = new lambda.Function(this, 'GetProfileFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getProfile.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getProfile')),
            environment: {
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for updating user profile
        const updateProfileFunction = new lambda.Function(this, 'UpdateProfileFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'updateProfile.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('updateProfile')),
            environment: {
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for following a user
        const followUserFunction = new lambda.Function(this, 'FollowUserFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'followUser.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('followUser')),
            environment: {
                USERS_TABLE: this.usersTable.tableName,
                FOLLOWS_TABLE: this.followsTable.tableName
            }
        });
        // Lambda function for unfollowing a user
        const unfollowUserFunction = new lambda.Function(this, 'UnfollowUserFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'unfollowUser.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('unfollowUser')),
            environment: {
                USERS_TABLE: this.usersTable.tableName,
                FOLLOWS_TABLE: this.followsTable.tableName
            }
        });
        // Lambda function for checking if following a user
        const checkFollowingFunction = new lambda.Function(this, 'CheckFollowingFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'checkFollowing.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('checkFollowing')),
            environment: {
                FOLLOWS_TABLE: this.followsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for creating posts
        const createPostFunction = new lambda.Function(this, 'CreatePostFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'createPost.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('createPost')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting posts
        const getPostsFunction = new lambda.Function(this, 'GetPostsFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getPosts.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getPosts')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for liking posts
        const likePostFunction = new lambda.Function(this, 'LikePostFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'likePost.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('likePost')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                LIKES_TABLE: this.likesTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for creating comments
        const createCommentFunction = new lambda.Function(this, 'CreateCommentFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'createComment.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('createComment')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                COMMENTS_TABLE: this.commentsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for getting comments
        const getCommentsFunction = new lambda.Function(this, 'GetCommentsFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'getComments.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('getComments')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                COMMENTS_TABLE: this.commentsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Lambda function for deleting comments
        const deleteCommentFunction = new lambda.Function(this, 'DeleteCommentFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'deleteComment.handler',
            code: lambda.Code.fromAsset(getLambdaPackagePath('deleteComment')),
            environment: {
                POSTS_TABLE: this.postsTable.tableName,
                COMMENTS_TABLE: this.commentsTable.tableName,
                USERS_TABLE: this.usersTable.tableName
            }
        });
        // Grant permissions to Lambda functions
        this.userPool.grant(registerFunction, 'cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword');
        this.userPool.grant(loginFunction, 'cognito-idp:AdminInitiateAuth', 'cognito-idp:GetUser');
        this.usersTable.grantReadWriteData(registerFunction);
        this.usersTable.grantReadData(loginFunction);
        this.usersTable.grantReadData(getProfileFunction);
        this.usersTable.grantReadWriteData(updateProfileFunction);
        this.usersTable.grantReadWriteData(followUserFunction);
        this.usersTable.grantReadWriteData(unfollowUserFunction);
        this.usersTable.grantReadData(getPostsFunction); // Add read permission for Users table
        this.usersTable.grantReadData(createPostFunction); // Add read permission for Users table
        this.usersTable.grantReadData(likePostFunction); // Add read permission for Users table
        this.usersTable.grantReadData(checkFollowingFunction); // Add read permission for Users table
        this.followsTable.grantReadWriteData(followUserFunction);
        this.followsTable.grantReadWriteData(unfollowUserFunction);
        this.followsTable.grantReadData(checkFollowingFunction);
        this.postsTable.grantReadWriteData(createPostFunction);
        this.postsTable.grantReadData(getPostsFunction);
        this.postsTable.grantReadWriteData(likePostFunction);
        this.likesTable.grantReadWriteData(likePostFunction);
        this.commentsTable.grantReadWriteData(createCommentFunction);
        this.postsTable.grantReadWriteData(createCommentFunction);
        this.usersTable.grantReadData(createCommentFunction);
        this.commentsTable.grantReadData(getCommentsFunction);
        this.postsTable.grantReadData(getCommentsFunction);
        this.usersTable.grantReadData(getCommentsFunction);
        this.commentsTable.grantReadWriteData(deleteCommentFunction);
        this.postsTable.grantReadWriteData(deleteCommentFunction);
        this.usersTable.grantReadData(deleteCommentFunction);
        // API Gateway endpoints
        const auth = this.api.root.addResource('auth');
        const register = auth.addResource('register');
        register.addMethod('POST', new apigateway.LambdaIntegration(registerFunction));
        const login = auth.addResource('login');
        login.addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
        const users = this.api.root.addResource('users');
        const userId = users.addResource('{userId}');
        userId.addMethod('GET', new apigateway.LambdaIntegration(getProfileFunction));
        userId.addMethod('PUT', new apigateway.LambdaIntegration(updateProfileFunction));
        // Follow/unfollow endpoints
        const follow = userId.addResource('follow');
        follow.addMethod('POST', new apigateway.LambdaIntegration(followUserFunction));
        const unfollow = userId.addResource('unfollow');
        unfollow.addMethod('POST', new apigateway.LambdaIntegration(unfollowUserFunction));
        const following = userId.addResource('following');
        following.addMethod('GET', new apigateway.LambdaIntegration(checkFollowingFunction));
        const posts = this.api.root.addResource('posts');
        posts.addMethod('GET', new apigateway.LambdaIntegration(getPostsFunction));
        posts.addMethod('POST', new apigateway.LambdaIntegration(createPostFunction));
        const userPosts = userId.addResource('posts');
        userPosts.addMethod('GET', new apigateway.LambdaIntegration(getPostsFunction));
        const postId = posts.addResource('{postId}');
        const likePost = postId.addResource('like');
        likePost.addMethod('POST', new apigateway.LambdaIntegration(likePostFunction));
        const comments = postId.addResource('comments');
        comments.addMethod('GET', new apigateway.LambdaIntegration(getCommentsFunction));
        comments.addMethod('POST', new apigateway.LambdaIntegration(createCommentFunction));
        const commentId = comments.addResource('{commentId}');
        commentId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCommentFunction));
        // S3 bucket for frontend hosting
        this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Keep all public access blocked
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
            autoDeleteObjects: true, // For development only
        });
        // CloudFront Origin Access Identity
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
            comment: 'Allow CloudFront to access the S3 bucket'
        });
        // Grant read permissions to CloudFront OAI
        this.websiteBucket.grantRead(originAccessIdentity);
        // CloudFront distribution
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.websiteBucket, {
                    originAccessIdentity: originAccessIdentity
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html', // Serve index.html as the root
            errorResponses: [
                {
                    // Return index.html for 403 errors (when file not found)
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(0)
                },
                {
                    // Return index.html for 404 errors (when file not found)
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(0)
                }
            ]
        });
        // Grant authenticated users access to their own user data
        this.usersTable.grantReadWriteData(authenticatedRole);
        this.postsTable.grantReadWriteData(authenticatedRole);
        this.likesTable.grantReadWriteData(authenticatedRole);
        this.commentsTable.grantReadWriteData(authenticatedRole);
        this.followsTable.grantReadWriteData(authenticatedRole);
        // Output the configuration values for frontend .env file
        // Order matches the .env file: VITE_API_URL, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID, VITE_IDENTITY_POOL_ID
        new cdk.CfnOutput(this, 'ViteApiUrl', {
            value: this.api.url,
            description: 'API Gateway endpoint URL'
        });
        new cdk.CfnOutput(this, 'ViteUserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID'
        });
        new cdk.CfnOutput(this, 'ViteUserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID'
        });
        new cdk.CfnOutput(this, 'ViteIdentityPoolId', {
            value: this.identityPool.ref,
            description: 'Cognito Identity Pool ID'
        });
    }
}
exports.AppStack = AppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2FwcC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQyxtRUFBcUQ7QUFDckQsdUVBQXlEO0FBQ3pELCtEQUFpRDtBQUNqRCx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUk5RCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFHN0IsTUFBYSxRQUFTLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFhckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw2Q0FBNkM7UUFDN0MsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLFlBQW9CLEVBQUUsRUFBRTtZQUNwRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9DQUFvQyxFQUFFLEdBQUcsWUFBWSxNQUFNLENBQUMsQ0FBQztRQUMzRixDQUFDLENBQUM7UUFFRixvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNyRCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0Isa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtnQkFDeEMsaUJBQWlCLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7YUFDckQ7WUFDRCxjQUFjLEVBQUU7Z0JB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LG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUc7WUFDNUIsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7SUFFTCxDQUFDO0NBQ0Y7QUEvY0QsNEJBK2NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xyXG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xyXG5cclxuZGVjbGFyZSBjb25zdCByZXF1aXJlOiBhbnk7XHJcbmRlY2xhcmUgY29uc3QgX19kaXJuYW1lOiBzdHJpbmc7XHJcbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XHJcblxyXG5cclxuZXhwb3J0IGNsYXNzIEFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xyXG4gIHB1YmxpYyByZWFkb25seSBpZGVudGl0eVBvb2w6IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sO1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2Vyc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgcG9zdHNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGxpa2VzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tZW50c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZm9sbG93c1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNpdGVCdWNrZXQ6IHMzLkJ1Y2tldDtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGdldCBMYW1iZGEgcGFja2FnZSBwYXRoXHJcbiAgICBjb25zdCBnZXRMYW1iZGFQYWNrYWdlUGF0aCA9IChmdW5jdGlvbk5hbWU6IHN0cmluZykgPT4ge1xyXG4gICAgICByZXR1cm4gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQvZGlzdC9sYW1iZGEtcGFja2FnZXMnLCBgJHtmdW5jdGlvbk5hbWV9LnppcGApO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcclxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXHJcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcclxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgZW1haWw6IHsgcmVxdWlyZWQ6IHRydWUsIG11dGFibGU6IHRydWUgfSxcclxuICAgICAgICBwcmVmZXJyZWRVc2VybmFtZTogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogdHJ1ZSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XHJcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZVxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcclxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSB0aGlzLnVzZXJQb29sLmFkZENsaWVudCgnVXNlclBvb2xDbGllbnQnLCB7XHJcbiAgICAgIGF1dGhGbG93czoge1xyXG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcclxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxyXG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlICAvLyBFbmFibGUgQURNSU5fVVNFUl9QQVNTV09SRF9BVVRIIGZsb3dcclxuICAgICAgfSxcclxuICAgICAgcHJldmVudFVzZXJFeGlzdGVuY2VFcnJvcnM6IHRydWVcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIElkZW50aXR5IFBvb2xcclxuICAgIHRoaXMuaWRlbnRpdHlQb29sID0gbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sKHRoaXMsICdJZGVudGl0eVBvb2wnLCB7XHJcbiAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogZmFsc2UsXHJcbiAgICAgIGNvZ25pdG9JZGVudGl0eVByb3ZpZGVyczogW3tcclxuICAgICAgICBjbGllbnRJZDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgIHByb3ZpZGVyTmFtZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbFByb3ZpZGVyTmFtZVxyXG4gICAgICB9XVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSUFNIFJvbGVzIGZvciBhdXRoZW50aWNhdGVkIGFuZCB1bmF1dGhlbnRpY2F0ZWQgdXNlcnNcclxuICAgIGNvbnN0IGF1dGhlbnRpY2F0ZWRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBdXRoZW50aWNhdGVkUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkZlZGVyYXRlZFByaW5jaXBhbChcclxuICAgICAgICAnY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tJyxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcclxuICAgICAgICAgICAgJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWQnOiB0aGlzLmlkZW50aXR5UG9vbC5yZWZcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnRm9yQW55VmFsdWU6U3RyaW5nTGlrZSc6IHtcclxuICAgICAgICAgICAgJ2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXInOiAnYXV0aGVudGljYXRlZCdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgICdzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eSdcclxuICAgICAgKVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQXR0YWNoIHJvbGUgdG8gaWRlbnRpdHkgcG9vbFxyXG4gICAgbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQodGhpcywgJ0lkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50Jywge1xyXG4gICAgICBpZGVudGl0eVBvb2xJZDogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxyXG4gICAgICByb2xlczoge1xyXG4gICAgICAgIGF1dGhlbnRpY2F0ZWQ6IGF1dGhlbnRpY2F0ZWRSb2xlLnJvbGVBcm5cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgVXNlcnMgVGFibGVcclxuICAgIHRoaXMudXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlcnNUYWJsZScsIHtcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBHU0kgZm9yIHVzZXJuYW1lIGxvb2t1cHNcclxuICAgIHRoaXMudXNlcnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ3VzZXJuYW1lLWluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VybmFtZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIER5bmFtb0RCIFBvc3RzIFRhYmxlXHJcbiAgICB0aGlzLnBvc3RzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1Bvc3RzVGFibGUnLCB7XHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgR1NJIGZvciB1c2VyJ3MgcG9zdHNcclxuICAgIHRoaXMucG9zdHNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ3VzZXJJZC1pbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgTGlrZXMgVGFibGVcclxuICAgIHRoaXMubGlrZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnTGlrZXNUYWJsZScsIHtcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdwb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgR1NJIGZvciBwb3N0J3MgbGlrZXNcclxuICAgIHRoaXMubGlrZXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ3Bvc3RJZC1pbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncG9zdElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgQ29tbWVudHMgVGFibGVcclxuICAgIHRoaXMuY29tbWVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29tbWVudHNUYWJsZScsIHtcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gRm9yIGRldmVsb3BtZW50IG9ubHlcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBHU0kgZm9yIHBvc3QncyBjb21tZW50c1xyXG4gICAgdGhpcy5jb21tZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAncG9zdElkLWluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEeW5hbW9EQiBGb2xsb3dzIFRhYmxlXHJcbiAgICB0aGlzLmZvbGxvd3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRm9sbG93c1RhYmxlJywge1xyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZvbGxvd2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmb2xsb3dlZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSAvLyBGb3IgZGV2ZWxvcG1lbnQgb25seVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIEdTSSBmb3IgZm9sbG93ZWUncyBmb2xsb3dlcnNcclxuICAgIHRoaXMuZm9sbG93c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnZm9sbG93ZWUtaW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZvbGxvd2VlSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdmb2xsb3dlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIEdhdGV3YXlcclxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnTWljcm9CbG9nZ2luZ0FwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdNaWNybyBCbG9nZ2luZyBBUEknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgTWljcm8gQmxvZ2dpbmcgYXBwbGljYXRpb24nLFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcclxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IGFwaWdhdGV3YXkuQ29ycy5ERUZBVUxUX0hFQURFUlMsXHJcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHJlZ2lzdHJhdGlvblxyXG4gICAgY29uc3QgcmVnaXN0ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JlZ2lzdGVyRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAncmVnaXN0ZXIuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgncmVnaXN0ZXInKSksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgbG9naW5cclxuICAgIGNvbnN0IGxvZ2luRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMb2dpbkZ1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcclxuICAgICAgaGFuZGxlcjogJ2xvZ2luLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ2xvZ2luJykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGdldHRpbmcgdXNlciBwcm9maWxlXHJcbiAgICBjb25zdCBnZXRQcm9maWxlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRQcm9maWxlRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAnZ2V0UHJvZmlsZS5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdnZXRQcm9maWxlJykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgdXBkYXRpbmcgdXNlciBwcm9maWxlXHJcbiAgICBjb25zdCB1cGRhdGVQcm9maWxlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVQcm9maWxlRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAndXBkYXRlUHJvZmlsZS5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCd1cGRhdGVQcm9maWxlJykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgZm9sbG93aW5nIGEgdXNlclxyXG4gICAgY29uc3QgZm9sbG93VXNlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRm9sbG93VXNlckZ1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcclxuICAgICAgaGFuZGxlcjogJ2ZvbGxvd1VzZXIuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZm9sbG93VXNlcicpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBGT0xMT1dTX1RBQkxFOiB0aGlzLmZvbGxvd3NUYWJsZS50YWJsZU5hbWVcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciB1bmZvbGxvd2luZyBhIHVzZXJcclxuICAgIGNvbnN0IHVuZm9sbG93VXNlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVW5mb2xsb3dVc2VyRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAndW5mb2xsb3dVc2VyLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ3VuZm9sbG93VXNlcicpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBGT0xMT1dTX1RBQkxFOiB0aGlzLmZvbGxvd3NUYWJsZS50YWJsZU5hbWVcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBmb2xsb3dpbmcgYSB1c2VyXHJcbiAgICBjb25zdCBjaGVja0ZvbGxvd2luZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2hlY2tGb2xsb3dpbmdGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdjaGVja0ZvbGxvd2luZy5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdjaGVja0ZvbGxvd2luZycpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBGT0xMT1dTX1RBQkxFOiB0aGlzLmZvbGxvd3NUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWVcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBjcmVhdGluZyBwb3N0c1xyXG4gICAgY29uc3QgY3JlYXRlUG9zdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3JlYXRlUG9zdEZ1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcclxuICAgICAgaGFuZGxlcjogJ2NyZWF0ZVBvc3QuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnY3JlYXRlUG9zdCcpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGdldHRpbmcgcG9zdHNcclxuICAgIGNvbnN0IGdldFBvc3RzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRQb3N0c0Z1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcclxuICAgICAgaGFuZGxlcjogJ2dldFBvc3RzLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoZ2V0TGFtYmRhUGFja2FnZVBhdGgoJ2dldFBvc3RzJykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFBPU1RTX1RBQkxFOiB0aGlzLnBvc3RzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgbGlraW5nIHBvc3RzXHJcbiAgICBjb25zdCBsaWtlUG9zdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGlrZVBvc3RGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdsaWtlUG9zdC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdsaWtlUG9zdCcpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBMSUtFU19UQUJMRTogdGhpcy5saWtlc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGNvbW1lbnRzXHJcbiAgICBjb25zdCBjcmVhdGVDb21tZW50RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDcmVhdGVDb21tZW50RnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAnY3JlYXRlQ29tbWVudC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGdldExhbWJkYVBhY2thZ2VQYXRoKCdjcmVhdGVDb21tZW50JykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFBPU1RTX1RBQkxFOiB0aGlzLnBvc3RzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIENPTU1FTlRTX1RBQkxFOiB0aGlzLmNvbW1lbnRzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJTX1RBQkxFOiB0aGlzLnVzZXJzVGFibGUudGFibGVOYW1lXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgZ2V0dGluZyBjb21tZW50c1xyXG4gICAgY29uc3QgZ2V0Q29tbWVudHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldENvbW1lbnRzRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxyXG4gICAgICBoYW5kbGVyOiAnZ2V0Q29tbWVudHMuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZ2V0Q29tbWVudHMnKSksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgUE9TVFNfVEFCTEU6IHRoaXMucG9zdHNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQ09NTUVOVFNfVEFCTEU6IHRoaXMuY29tbWVudHNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVVNFUlNfVEFCTEU6IHRoaXMudXNlcnNUYWJsZS50YWJsZU5hbWVcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBkZWxldGluZyBjb21tZW50c1xyXG4gICAgY29uc3QgZGVsZXRlQ29tbWVudEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRGVsZXRlQ29tbWVudEZ1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcclxuICAgICAgaGFuZGxlcjogJ2RlbGV0ZUNvbW1lbnQuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChnZXRMYW1iZGFQYWNrYWdlUGF0aCgnZGVsZXRlQ29tbWVudCcpKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBQT1NUU19UQUJMRTogdGhpcy5wb3N0c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBDT01NRU5UU19UQUJMRTogdGhpcy5jb21tZW50c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSU19UQUJMRTogdGhpcy51c2Vyc1RhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcblxyXG5cclxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIExhbWJkYSBmdW5jdGlvbnNcclxuICAgIHRoaXMudXNlclBvb2wuZ3JhbnQocmVnaXN0ZXJGdW5jdGlvbiwgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcpO1xyXG4gICAgdGhpcy51c2VyUG9vbC5ncmFudChsb2dpbkZ1bmN0aW9uLCAnY29nbml0by1pZHA6QWRtaW5Jbml0aWF0ZUF1dGgnLCAnY29nbml0by1pZHA6R2V0VXNlcicpO1xyXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShyZWdpc3RlckZ1bmN0aW9uKTtcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWREYXRhKGxvZ2luRnVuY3Rpb24pO1xyXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UHJvZmlsZUZ1bmN0aW9uKTtcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXBkYXRlUHJvZmlsZUZ1bmN0aW9uKTtcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZm9sbG93VXNlckZ1bmN0aW9uKTtcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodW5mb2xsb3dVc2VyRnVuY3Rpb24pO1xyXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UG9zdHNGdW5jdGlvbik7ICAvLyBBZGQgcmVhZCBwZXJtaXNzaW9uIGZvciBVc2VycyB0YWJsZVxyXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoY3JlYXRlUG9zdEZ1bmN0aW9uKTsgIC8vIEFkZCByZWFkIHBlcm1pc3Npb24gZm9yIFVzZXJzIHRhYmxlXHJcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShsaWtlUG9zdEZ1bmN0aW9uKTsgIC8vIEFkZCByZWFkIHBlcm1pc3Npb24gZm9yIFVzZXJzIHRhYmxlXHJcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShjaGVja0ZvbGxvd2luZ0Z1bmN0aW9uKTsgIC8vIEFkZCByZWFkIHBlcm1pc3Npb24gZm9yIFVzZXJzIHRhYmxlXHJcbiAgICB0aGlzLmZvbGxvd3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZm9sbG93VXNlckZ1bmN0aW9uKTtcclxuICAgIHRoaXMuZm9sbG93c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1bmZvbGxvd1VzZXJGdW5jdGlvbik7XHJcbiAgICB0aGlzLmZvbGxvd3NUYWJsZS5ncmFudFJlYWREYXRhKGNoZWNrRm9sbG93aW5nRnVuY3Rpb24pO1xyXG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjcmVhdGVQb3N0RnVuY3Rpb24pO1xyXG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UG9zdHNGdW5jdGlvbik7XHJcbiAgICB0aGlzLnBvc3RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxpa2VQb3N0RnVuY3Rpb24pO1xyXG4gICAgdGhpcy5saWtlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsaWtlUG9zdEZ1bmN0aW9uKTtcclxuICAgIHRoaXMuY29tbWVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY3JlYXRlQ29tbWVudEZ1bmN0aW9uKTtcclxuICAgIHRoaXMucG9zdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY3JlYXRlQ29tbWVudEZ1bmN0aW9uKTtcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWREYXRhKGNyZWF0ZUNvbW1lbnRGdW5jdGlvbik7XHJcbiAgICB0aGlzLmNvbW1lbnRzVGFibGUuZ3JhbnRSZWFkRGF0YShnZXRDb21tZW50c0Z1bmN0aW9uKTtcclxuICAgIHRoaXMucG9zdHNUYWJsZS5ncmFudFJlYWREYXRhKGdldENvbW1lbnRzRnVuY3Rpb24pO1xyXG4gICAgdGhpcy51c2Vyc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0Q29tbWVudHNGdW5jdGlvbik7XHJcbiAgICB0aGlzLmNvbW1lbnRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRlbGV0ZUNvbW1lbnRGdW5jdGlvbik7XHJcbiAgICB0aGlzLnBvc3RzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRlbGV0ZUNvbW1lbnRGdW5jdGlvbik7XHJcbiAgICB0aGlzLnVzZXJzVGFibGUuZ3JhbnRSZWFkRGF0YShkZWxldGVDb21tZW50RnVuY3Rpb24pO1xyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5IGVuZHBvaW50c1xyXG4gICAgY29uc3QgYXV0aCA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2F1dGgnKTtcclxuICAgIGNvbnN0IHJlZ2lzdGVyID0gYXV0aC5hZGRSZXNvdXJjZSgncmVnaXN0ZXInKTtcclxuICAgIHJlZ2lzdGVyLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHJlZ2lzdGVyRnVuY3Rpb24pKTtcclxuICAgIFxyXG4gICAgY29uc3QgbG9naW4gPSBhdXRoLmFkZFJlc291cmNlKCdsb2dpbicpO1xyXG4gICAgbG9naW4uYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obG9naW5GdW5jdGlvbikpO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndXNlcnMnKTtcclxuICAgIGNvbnN0IHVzZXJJZCA9IHVzZXJzLmFkZFJlc291cmNlKCd7dXNlcklkfScpO1xyXG4gICAgdXNlcklkLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZmlsZUZ1bmN0aW9uKSk7XHJcbiAgICB1c2VySWQuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVQcm9maWxlRnVuY3Rpb24pKTtcclxuXHJcbiAgICAvLyBGb2xsb3cvdW5mb2xsb3cgZW5kcG9pbnRzXHJcbiAgICBjb25zdCBmb2xsb3cgPSB1c2VySWQuYWRkUmVzb3VyY2UoJ2ZvbGxvdycpO1xyXG4gICAgZm9sbG93LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZvbGxvd1VzZXJGdW5jdGlvbikpO1xyXG4gICAgXHJcbiAgICBjb25zdCB1bmZvbGxvdyA9IHVzZXJJZC5hZGRSZXNvdXJjZSgndW5mb2xsb3cnKTtcclxuICAgIHVuZm9sbG93LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVuZm9sbG93VXNlckZ1bmN0aW9uKSk7XHJcbiAgICBcclxuICAgIGNvbnN0IGZvbGxvd2luZyA9IHVzZXJJZC5hZGRSZXNvdXJjZSgnZm9sbG93aW5nJyk7XHJcbiAgICBmb2xsb3dpbmcuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjaGVja0ZvbGxvd2luZ0Z1bmN0aW9uKSk7XHJcblxyXG4gICAgY29uc3QgcG9zdHMgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdwb3N0cycpO1xyXG4gICAgcG9zdHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQb3N0c0Z1bmN0aW9uKSk7XHJcbiAgICBwb3N0cy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVQb3N0RnVuY3Rpb24pKTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9zdHMgPSB1c2VySWQuYWRkUmVzb3VyY2UoJ3Bvc3RzJyk7XHJcbiAgICB1c2VyUG9zdHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRQb3N0c0Z1bmN0aW9uKSk7XHJcblxyXG4gICAgY29uc3QgcG9zdElkID0gcG9zdHMuYWRkUmVzb3VyY2UoJ3twb3N0SWR9Jyk7XHJcbiAgICBjb25zdCBsaWtlUG9zdCA9IHBvc3RJZC5hZGRSZXNvdXJjZSgnbGlrZScpO1xyXG4gICAgbGlrZVBvc3QuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obGlrZVBvc3RGdW5jdGlvbikpO1xyXG5cclxuICAgIGNvbnN0IGNvbW1lbnRzID0gcG9zdElkLmFkZFJlc291cmNlKCdjb21tZW50cycpO1xyXG4gICAgY29tbWVudHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRDb21tZW50c0Z1bmN0aW9uKSk7XHJcbiAgICBjb21tZW50cy5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihjcmVhdGVDb21tZW50RnVuY3Rpb24pKTtcclxuXHJcbiAgICBjb25zdCBjb21tZW50SWQgPSBjb21tZW50cy5hZGRSZXNvdXJjZSgne2NvbW1lbnRJZH0nKTtcclxuICAgIGNvbW1lbnRJZC5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGRlbGV0ZUNvbW1lbnRGdW5jdGlvbikpO1xyXG5cclxuICAgIC8vIFMzIGJ1Y2tldCBmb3IgZnJvbnRlbmQgaG9zdGluZ1xyXG4gICAgdGhpcy53ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnV2Vic2l0ZUJ1Y2tldCcsIHtcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCwgLy8gS2VlcCBhbGwgcHVibGljIGFjY2VzcyBibG9ja2VkXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEZvciBkZXZlbG9wbWVudCBvbmx5XHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLCAvLyBGb3IgZGV2ZWxvcG1lbnQgb25seVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ2xvdWRGcm9udCBPcmlnaW4gQWNjZXNzIElkZW50aXR5XHJcbiAgICBjb25zdCBvcmlnaW5BY2Nlc3NJZGVudGl0eSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPcmlnaW5BY2Nlc3NJZGVudGl0eScsIHtcclxuICAgICAgY29tbWVudDogJ0FsbG93IENsb3VkRnJvbnQgdG8gYWNjZXNzIHRoZSBTMyBidWNrZXQnXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCByZWFkIHBlcm1pc3Npb25zIHRvIENsb3VkRnJvbnQgT0FJXHJcbiAgICB0aGlzLndlYnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9yaWdpbkFjY2Vzc0lkZW50aXR5KTtcclxuXHJcbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvblxyXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcclxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XHJcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLndlYnNpdGVCdWNrZXQsIHtcclxuICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvcmlnaW5BY2Nlc3NJZGVudGl0eVxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxyXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLCAvLyBTZXJ2ZSBpbmRleC5odG1sIGFzIHRoZSByb290XHJcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgLy8gUmV0dXJuIGluZGV4Lmh0bWwgZm9yIDQwMyBlcnJvcnMgKHdoZW4gZmlsZSBub3QgZm91bmQpXHJcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXHJcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcclxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXHJcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDApXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAvLyBSZXR1cm4gaW5kZXguaHRtbCBmb3IgNDA0IGVycm9ycyAod2hlbiBmaWxlIG5vdCBmb3VuZClcclxuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcclxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxyXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcclxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMClcclxuICAgICAgICB9XHJcbiAgICAgIF1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IGF1dGhlbnRpY2F0ZWQgdXNlcnMgYWNjZXNzIHRvIHRoZWlyIG93biB1c2VyIGRhdGFcclxuICAgIHRoaXMudXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xyXG4gICAgdGhpcy5wb3N0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhdXRoZW50aWNhdGVkUm9sZSk7XHJcbiAgICB0aGlzLmxpa2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGF1dGhlbnRpY2F0ZWRSb2xlKTtcclxuICAgIHRoaXMuY29tbWVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aGVudGljYXRlZFJvbGUpO1xyXG4gICAgdGhpcy5mb2xsb3dzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGF1dGhlbnRpY2F0ZWRSb2xlKTtcclxuXHJcbiAgICAvLyBPdXRwdXQgdGhlIGNvbmZpZ3VyYXRpb24gdmFsdWVzIGZvciBmcm9udGVuZCAuZW52IGZpbGVcclxuICAgIC8vIE9yZGVyIG1hdGNoZXMgdGhlIC5lbnYgZmlsZTogVklURV9BUElfVVJMLCBWSVRFX1VTRVJfUE9PTF9JRCwgVklURV9VU0VSX1BPT0xfQ0xJRU5UX0lELCBWSVRFX0lERU5USVRZX1BPT0xfSURcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWaXRlQXBpVXJsJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGVuZHBvaW50IFVSTCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWaXRlVXNlclBvb2xJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCdcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWaXRlVXNlclBvb2xDbGllbnRJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVml0ZUlkZW50aXR5UG9vbElkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gSWRlbnRpdHkgUG9vbCBJRCdcclxuICAgIH0pO1xyXG5cclxuICB9XHJcbn1cclxuIl19