# Code Review: app-stack.ts

**File Type**: CDK Construct

## Critical Issues ❌

### Missing Removal Policy on DynamoDB Tables

- **infrastructure/lib/app-stack.ts:45-52** - DynamoDB tables don't specify removal policy
  - **Why it matters**: Without explicit removal policy, tables may be deleted on stack deletion, causing data loss in production
  - **Suggested fix**:
    ```typescript
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Prevent accidental deletion
    });
    ```

### Overly Permissive IAM Policy

- **infrastructure/lib/app-stack.ts:120** - Lambda function granted `dynamodb:*` on all tables
  - **Why it matters**: Violates least-privilege principle; function could accidentally delete or modify unrelated tables
  - **Suggested fix**:
    ```typescript
    // Instead of granting all actions
    usersTable.grantReadWriteData(createPostFunction);
    postsTable.grantReadWriteData(createPostFunction);
    
    // Or be more specific
    createPostFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
      resources: [postsTable.tableArn],
    }));
    ```

## Warnings ⚠️

### Hardcoded Lambda Memory Size

- **infrastructure/lib/app-stack.ts:95** - Lambda memory set to 128 MB without justification
  - **Why it matters**: May be insufficient for functions with heavy processing; should be configurable or based on testing
  - **Suggested fix**:
    ```typescript
    const defaultMemorySize = 256; // Or read from context/env
    
    const createPostFunction = new lambda.Function(this, 'CreatePostFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: defaultMemorySize,
      // ...
    });
    ```

### Missing CloudWatch Alarms

- **infrastructure/lib/app-stack.ts** - No alarms configured for Lambda errors or DynamoDB throttling
  - **Why it matters**: Production issues won't be detected automatically
  - **Suggested fix**:
    ```typescript
    import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
    
    const errorAlarm = new cloudwatch.Alarm(this, 'CreatePostErrorAlarm', {
      metric: createPostFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when CreatePost function has errors',
    });
    ```

### API Gateway Lacks Throttling

- **infrastructure/lib/app-stack.ts:150** - API Gateway has no usage plan or throttling configured
  - **Why it matters**: API could be overwhelmed by traffic spikes or abuse
  - **Suggested fix**:
    ```typescript
    const plan = api.addUsagePlan('UsagePlan', {
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
    });
    ```

## Suggestions 💡

### Extract Table Definitions

- **infrastructure/lib/app-stack.ts:40-80** - All table definitions in one method makes the file long
  - **Why it matters**: Improves readability and maintainability
  - **Suggested fix**: Create helper methods:
    ```typescript
    private createUsersTable(): dynamodb.Table {
      return new dynamodb.Table(this, 'UsersTable', {
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    }
    
    // In constructor
    const usersTable = this.createUsersTable();
    ```

### Add Stack Outputs

- **infrastructure/lib/app-stack.ts** - No CfnOutput for important resources
  - **Why it matters**: Makes it easier to reference resources in other stacks or scripts
  - **Suggested fix**:
    ```typescript
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'MicroBlogApiUrl',
    });
    
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    ```

### Use Environment-Specific Configuration

- **infrastructure/lib/app-stack.ts** - No distinction between dev/staging/prod environments
  - **Why it matters**: Different environments should have different settings (removal policies, alarms, etc.)
  - **Suggested fix**:
    ```typescript
    interface AppStackProps extends cdk.StackProps {
      environment: 'dev' | 'staging' | 'prod';
    }
    
    constructor(scope: Construct, id: string, props: AppStackProps) {
      super(scope, id, props);
      
      const removalPolicy = props.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY;
      
      // Use removalPolicy in resource definitions
    }
    ```

### Add Tags for Cost Tracking

- **infrastructure/lib/app-stack.ts** - No resource tagging
  - **Why it matters**: Makes it difficult to track costs by project or environment
  - **Suggested fix**:
    ```typescript
    cdk.Tags.of(this).add('Project', 'MicroBlogging');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    ```

## Passed Checks ✅

- ✅ Uses PascalCase for construct IDs
- ✅ Descriptive resource names (UsersTable, CreatePostFunction)
- ✅ Uses environment variables to pass config to Lambda
- ✅ Properly grants table access to Lambda functions
- ✅ Uses Node.js 22 runtime (matches backend)
- ✅ Configures CORS on API Gateway
- ✅ Uses DynamoDB on-demand billing (cost-effective for variable workloads)
- ✅ Creates GSIs for secondary access patterns
- ✅ Bundles Lambda code from correct source directories
- ✅ Configures Cognito User Pool with email sign-in

## Summary

The stack is well-structured but has **2 critical issues** that must be addressed:
1. Missing removal policies on DynamoDB tables (data loss risk)
2. Overly permissive IAM policies (security risk)

**Priority**: Fix critical issues before deploying to production. The warnings should be addressed to improve operational visibility and resilience.

**Estimated effort**: 1-2 hours to fix critical issues and add monitoring/throttling.

**Infrastructure Note**: After making IAM changes, test all Lambda functions to ensure they still have necessary permissions. Consider using `cdk diff` to preview changes before deployment.
