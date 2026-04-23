# Infrastructure Conventions

## AWS CDK Standards

### Stack Structure

#### Basic Stack Pattern
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class AppStack extends cdk.Stack {
  // Public properties for cross-stack references
  public readonly api: apigateway.RestApi;
  public readonly table: dynamodb.Table;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 1. Define resources
    // 2. Configure permissions
    // 3. Wire integrations
    // 4. Create outputs
  }
}
```

**Rules:**
- Extend `cdk.Stack`
- Export public properties for important resources
- Organize constructor in logical sections
- Use TypeScript for all CDK code

### Resource Naming

```typescript
// PascalCase for construct IDs
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  // configuration
});

const loginFunction = new lambda.Function(this, 'LoginFunction', {
  // configuration
});

const api = new apigateway.RestApi(this, 'MicroBloggingApi', {
  // configuration
});
```

**Rules:**
- Use PascalCase for construct IDs
- Use descriptive names that indicate resource type
- Suffix with resource type (Table, Function, Api, etc.)
- Store in camelCase variables

### DynamoDB Table Patterns

#### Basic Table
```typescript
const table = new dynamodb.Table(this, 'TableName', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
});
```

#### Table with Sort Key
```typescript
const table = new dynamodb.Table(this, 'TableName', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

#### Global Secondary Index
```typescript
table.addGlobalSecondaryIndex({
  indexName: 'username-index',
  partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// With sort key
table.addGlobalSecondaryIndex({
  indexName: 'userId-index',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**Rules:**
- Use PAY_PER_REQUEST billing mode for variable workloads
- Use DESTROY removal policy only in development
- Name GSIs with `-index` suffix
- Use ALL projection type unless specific keys needed
- Add GSIs immediately after table creation

### Lambda Function Patterns

#### Basic Function
```typescript
const functionName = new lambda.Function(this, 'FunctionName', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'fileName.handler',
  code: lambda.Code.fromAsset(getLambdaPackagePath('fileName')),
  environment: {
    TABLE_NAME: table.tableName,
    USER_POOL_ID: userPool.userPoolId,
  },
});
```

#### Lambda Package Path Helper
```typescript
declare const require: any;
declare const __dirname: string;
const path = require('path');

const getLambdaPackagePath = (functionName: string) => {
  return path.join(__dirname, '../../backend/dist/lambda-packages', `${functionName}.zip`);
};
```

**Rules:**
- Use NODEJS_22_X runtime
- Handler format: `fileName.handler`
- Use fromAsset with zip packages
- Pass all config via environment variables
- Define helper function for package paths

### IAM Permission Patterns

#### DynamoDB Permissions
```typescript
// Read-only access
table.grantReadData(lambdaFunction);

// Write access
table.grantWriteData(lambdaFunction);

// Read and write access
table.grantReadWriteData(lambdaFunction);
```

#### Cognito Permissions
```typescript
userPool.grant(
  lambdaFunction,
  'cognito-idp:AdminCreateUser',
  'cognito-idp:AdminSetUserPassword'
);

userPool.grant(
  lambdaFunction,
  'cognito-idp:AdminInitiateAuth',
  'cognito-idp:GetUser'
);
```

**Rules:**
- Use grant methods instead of manual policies
- Grant minimum required permissions
- Group related permissions together
- Add comments for complex permission sets

### API Gateway Patterns

#### REST API
```typescript
const api = new apigateway.RestApi(this, 'ApiName', {
  restApiName: 'Display Name',
  description: 'API description',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
    allowCredentials: true,
  },
});
```

#### Resource Hierarchy
```typescript
// /auth
const auth = api.root.addResource('auth');

// /auth/login
const login = auth.addResource('login');
login.addMethod('POST', new apigateway.LambdaIntegration(loginFunction));

// /auth/register
const register = auth.addResource('register');
register.addMethod('POST', new apigateway.LambdaIntegration(registerFunction));

// /users/{userId}
const users = api.root.addResource('users');
const userId = users.addResource('{userId}');
userId.addMethod('GET', new apigateway.LambdaIntegration(getProfileFunction));
userId.addMethod('PUT', new apigateway.LambdaIntegration(updateProfileFunction));

// /users/{userId}/follow
const follow = userId.addResource('follow');
follow.addMethod('POST', new apigateway.LambdaIntegration(followFunction));
```

**Rules:**
- Enable CORS for all APIs
- Use resource hierarchy that matches REST conventions
- Use path parameters with curly braces `{paramName}`
- Use LambdaIntegration for Lambda backends
- Group related endpoints under common resources

### Cognito Patterns

#### User Pool
```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
  selfSignUpEnabled: true,
  autoVerify: { email: true },
  standardAttributes: {
    email: { required: true, mutable: true },
    preferredUsername: { required: true, mutable: true },
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

#### User Pool Client
```typescript
const userPoolClient = userPool.addClient('UserPoolClient', {
  authFlows: {
    userPassword: true,
    userSrp: true,
    adminUserPassword: true,
  },
  preventUserExistenceErrors: true,
});
```

#### Identity Pool
```typescript
const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
  allowUnauthenticatedIdentities: false,
  cognitoIdentityProviders: [{
    clientId: userPoolClient.userPoolClientId,
    providerName: userPool.userPoolProviderName,
  }],
});
```

#### IAM Roles for Identity Pool
```typescript
const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
  assumedBy: new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: {
        'cognito-identity.amazonaws.com:aud': identityPool.ref,
      },
      'ForAnyValue:StringLike': {
        'cognito-identity.amazonaws.com:amr': 'authenticated',
      },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
});

new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
  identityPoolId: identityPool.ref,
  roles: {
    authenticated: authenticatedRole.roleArn,
  },
});
```

### S3 and CloudFront Patterns

#### S3 Bucket for Static Hosting
```typescript
const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});
```

#### CloudFront Distribution
```typescript
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
  comment: 'Allow CloudFront to access the S3 bucket',
});

websiteBucket.grantRead(originAccessIdentity);

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(websiteBucket, {
      originAccessIdentity: originAccessIdentity,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    {
      httpStatus: 403,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.minutes(0),
    },
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.minutes(0),
    },
  ],
});
```

**Rules:**
- Block all public S3 access, use CloudFront OAI
- Enable HTTPS redirect
- Configure SPA error responses (403/404 → index.html)
- Use CACHING_OPTIMIZED for static assets

### Stack Outputs

```typescript
new cdk.CfnOutput(this, 'ViteApiUrl', {
  value: api.url,
  description: 'API Gateway endpoint URL',
});

new cdk.CfnOutput(this, 'ViteUserPoolId', {
  value: userPool.userPoolId,
  description: 'Cognito User Pool ID',
});

new cdk.CfnOutput(this, 'ViteUserPoolClientId', {
  value: userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID',
});

new cdk.CfnOutput(this, 'ViteIdentityPoolId', {
  value: identityPool.ref,
  description: 'Cognito Identity Pool ID',
});

new cdk.CfnOutput(this, 'CloudFrontUrl', {
  value: distribution.distributionDomainName,
  description: 'CloudFront distribution URL',
});
```

**Rules:**
- Create outputs for values needed by frontend
- Use descriptive output names
- Include descriptions
- Prefix with target usage (Vite, etc.)

### Environment Variables Pattern

```typescript
const lambdaFunction = new lambda.Function(this, 'FunctionName', {
  // ... other config
  environment: {
    USERS_TABLE: usersTable.tableName,
    POSTS_TABLE: postsTable.tableName,
    LIKES_TABLE: likesTable.tableName,
    FOLLOWS_TABLE: followsTable.tableName,
    USER_POOL_ID: userPool.userPoolId,
    USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
  },
});
```

**Rules:**
- Use UPPER_SNAKE_CASE for environment variable names
- Pass table names, not ARNs
- Pass IDs for Cognito resources
- Only pass what the function needs

### Resource Organization

```typescript
export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 1. Cognito resources
    const userPool = new cognito.UserPool(/* ... */);
    const userPoolClient = userPool.addClient(/* ... */);
    const identityPool = new cognito.CfnIdentityPool(/* ... */);
    
    // 2. DynamoDB tables
    const usersTable = new dynamodb.Table(/* ... */);
    const postsTable = new dynamodb.Table(/* ... */);
    
    // 3. Lambda functions
    const loginFunction = new lambda.Function(/* ... */);
    const createPostFunction = new lambda.Function(/* ... */);
    
    // 4. IAM permissions
    usersTable.grantReadData(loginFunction);
    postsTable.grantReadWriteData(createPostFunction);
    
    // 5. API Gateway
    const api = new apigateway.RestApi(/* ... */);
    const auth = api.root.addResource('auth');
    
    // 6. S3 and CloudFront
    const websiteBucket = new s3.Bucket(/* ... */);
    const distribution = new cloudfront.Distribution(/* ... */);
    
    // 7. Outputs
    new cdk.CfnOutput(/* ... */);
  }
}
```

**Rules:**
- Group resources by type
- Define resources before using them
- Grant permissions after defining functions
- Create API structure after functions
- Add outputs at the end

### Removal Policies

```typescript
// Development
removalPolicy: cdk.RemovalPolicy.DESTROY,
autoDeleteObjects: true, // For S3 buckets

// Production
removalPolicy: cdk.RemovalPolicy.RETAIN,
```

**Rules:**
- Use DESTROY only in development
- Use RETAIN for production data
- Document removal policy choices
- Enable autoDeleteObjects for dev S3 buckets

### Import Patterns

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
```

**Rules:**
- Import entire service modules with `* as`
- Group AWS service imports together
- Import Construct separately
- Use alphabetical order for readability

## File Organization

```
infrastructure/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── app-stack.ts        # Main stack definition
├── cdk.json                # CDK configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## CDK Commands

```bash
# Synthesize CloudFormation template
cdk synth

# Show differences
cdk diff

# Deploy stack
cdk deploy

# Destroy stack
cdk destroy
```

## Best Practices

1. **Single Stack**: Keep all resources in one stack for simplicity
2. **Type Safety**: Use TypeScript for all CDK code
3. **Least Privilege**: Grant minimum required permissions
4. **Environment Variables**: Pass all config to Lambda via env vars
5. **Outputs**: Create outputs for frontend configuration
6. **Comments**: Document complex permission grants
7. **Naming**: Use consistent, descriptive names
8. **Organization**: Group related resources together
