# Quick Reference Guide

## Common Patterns Cheat Sheet

### Frontend Quick Reference

#### Component Template
```typescript
import React, { useState, useEffect } from 'react';

const Component: React.FC<Props> = ({ prop1, prop2 }) => {
  const [data, setData] = useState<Type[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const result = await api.getData(token);
        setData(result);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);
  
  return (
    <div className="component-name">
      {loading && <div className="loading"><div className="spinner" /></div>}
      {error && <div className="error-message">{error}</div>}
      {/* Content */}
    </div>
  );
};

export default Component;
```

#### API Call Template
```typescript
export const domainApi = {
  getResource: async (id: string, token: string): Promise<{ resource: Resource }> => {
    console.log(`Making request to: ${API_URL}/resources/${id}`);
    const response = await fetch(`${API_URL}/resources/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(response);
  },
  
  createResource: async (data: Data, token: string): Promise<{ resource: Resource }> => {
    const response = await fetch(`${API_URL}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};
```

### Backend Quick Reference

#### Lambda Handler Template
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return errorResponse(400, 'Missing request body');
    }
    
    const { field } = JSON.parse(event.body);
    if (!field || field.trim() === '') {
      return errorResponse(400, 'Field is required');
    }
    
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME not set');
    }
    
    const item = {
      id: uuidv4(),
      field,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await ddbDocClient.send(new PutCommand({
      TableName: tableName,
      Item: item,
    }));
    
    return successResponse(201, { message: 'Created', item });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

const corsHeaders = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
});

const successResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders(),
  body: JSON.stringify(body),
});

const errorResponse = (statusCode, message) => ({
  statusCode,
  headers: corsHeaders(),
  body: JSON.stringify({ message }),
});
```

#### Protected Handler Template
```javascript
const { withAuth } = require('../../common/middleware');

const handler = async (event) => {
  try {
    const userId = event.user.id;
    const username = event.user.username;
    
    // Handler logic
    
    return successResponse(200, { data });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

exports.handler = withAuth(handler);
```

### Infrastructure Quick Reference

#### Lambda Function
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

table.grantReadWriteData(functionName);
```

#### DynamoDB Table
```typescript
const table = new dynamodb.Table(this, 'TableName', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

table.addGlobalSecondaryIndex({
  indexName: 'field-index',
  partitionKey: { name: 'field', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

#### API Gateway Endpoint
```typescript
const resource = api.root.addResource('resource');
const resourceId = resource.addResource('{resourceId}');

resource.addMethod('GET', new apigateway.LambdaIntegration(listFunction));
resource.addMethod('POST', new apigateway.LambdaIntegration(createFunction));
resourceId.addMethod('GET', new apigateway.LambdaIntegration(getFunction));
resourceId.addMethod('PUT', new apigateway.LambdaIntegration(updateFunction));
resourceId.addMethod('DELETE', new apigateway.LambdaIntegration(deleteFunction));
```

## Common DynamoDB Operations

```javascript
// Put Item
await ddbDocClient.send(new PutCommand({
  TableName: tableName,
  Item: { id: uuidv4(), field: value },
}));

// Get Item
const result = await ddbDocClient.send(new GetCommand({
  TableName: tableName,
  Key: { id: itemId },
}));
const item = result.Item;

// Query with GSI
const result = await ddbDocClient.send(new QueryCommand({
  TableName: tableName,
  IndexName: 'field-index',
  KeyConditionExpression: 'field = :value',
  ExpressionAttributeValues: { ':value': value },
}));
const items = result.Items || [];

// Update Item
await ddbDocClient.send(new UpdateCommand({
  TableName: tableName,
  Key: { id: itemId },
  UpdateExpression: 'SET #field = :value, updatedAt = :timestamp',
  ExpressionAttributeNames: { '#field': 'field' },
  ExpressionAttributeValues: {
    ':value': newValue,
    ':timestamp': new Date().toISOString(),
  },
}));

// Delete Item
await ddbDocClient.send(new DeleteCommand({
  TableName: tableName,
  Key: { id: itemId },
}));
```

## Status Codes

```
200 OK              - Successful GET, PUT, action
201 Created         - Successful POST (resource created)
204 No Content      - Successful DELETE
400 Bad Request     - Invalid input
401 Unauthorized    - Missing/invalid auth
403 Forbidden       - Insufficient permissions
404 Not Found       - Resource doesn't exist
500 Server Error    - Unexpected error
```

## Response Formats

```javascript
// Success
{
  "message": "Success message",
  "resource": { /* data */ }
}

// Collection
{
  "resources": [ /* array */ ],
  "nextToken": "token-or-null"
}

// Error
{
  "message": "Error message",
  "error": "Details"
}
```

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=https://api.example.com
VITE_USER_POOL_ID=us-east-1_xxxxx
VITE_USER_POOL_CLIENT_ID=xxxxx
VITE_IDENTITY_POOL_ID=us-east-1:xxxxx
```

### Backend (Lambda)
```
USERS_TABLE=UsersTable
POSTS_TABLE=PostsTable
LIKES_TABLE=LikesTable
COMMENTS_TABLE=CommentsTable
FOLLOWS_TABLE=FollowsTable
USER_POOL_ID=us-east-1_xxxxx
USER_POOL_CLIENT_ID=xxxxx
```

## Common Imports

### Frontend
```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Type } from '../types/type';
```

### Backend
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminInitiateAuthCommand, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { v4: uuidv4 } = require('uuid');
const { withAuth } = require('../../common/middleware');
```

### Infrastructure
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
```

## Naming Conventions

### Frontend
- Components: PascalCase (`UserProfile.tsx`)
- Files: PascalCase for components, camelCase for utilities
- CSS classes: kebab-case (`user-profile`, `post-card`)
- Variables: camelCase (`userName`, `postId`)
- Types: PascalCase (`User`, `Post`, `Comment`)

### Backend
- Files: camelCase (`createPost.js`, `getProfile.js`)
- Functions: camelCase (`handler`, `withAuth`)
- Variables: camelCase (`userId`, `tableName`)
- Constants: UPPER_SNAKE_CASE (`MAX_LENGTH`)

### Infrastructure
- Construct IDs: PascalCase (`UsersTable`, `LoginFunction`)
- Variables: camelCase (`usersTable`, `loginFunction`)
- Environment vars: UPPER_SNAKE_CASE (`USERS_TABLE`)

## File Locations

```
frontend/src/
  components/     - Reusable UI components
  contexts/       - React contexts
  pages/          - Route-level pages
  services/       - API integration
  types/          - TypeScript types

backend/src/
  common/         - Shared utilities (middleware)
  functions/      - Lambda handlers by domain
    auth/
    posts/
    users/
    comments/

infrastructure/
  bin/            - CDK app entry
  lib/            - Stack definitions
```

## Validation Limits

```
Post content:     1-280 characters
Comment content:  1-500 characters
Username:         3-30 characters (alphanumeric + underscore)
Display name:     1-50 characters
Password:         8+ characters (upper, lower, digit)
Bio:              0-160 characters
```

## Common Errors to Avoid

1. ❌ Forgetting to wrap protected handlers with `withAuth`
2. ❌ Not validating environment variables
3. ❌ Missing CORS headers in responses
4. ❌ Not handling empty DynamoDB results
5. ❌ Using `event.body` without parsing
6. ❌ Forgetting to grant IAM permissions
7. ❌ Not including loading/error states in UI
8. ❌ Missing TypeScript type annotations
9. ❌ Not using `Bearer` prefix for auth tokens
10. ❌ Forgetting to update `updatedAt` timestamp
