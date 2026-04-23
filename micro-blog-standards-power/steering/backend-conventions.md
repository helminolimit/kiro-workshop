# Backend Conventions

## Node.js Lambda Handler Standards

### Handler Structure

#### Basic Handler Pattern
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Initialize clients at module level (outside handler)
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Lambda handler description
 * @param {Object} event - API Gateway event
 * @returns {Object} - API Gateway response
 */
exports.handler = async (event) => {
  try {
    // 1. Validate request
    if (!event.body) {
      return errorResponse(400, 'Missing request body');
    }
    
    // 2. Parse and validate input
    const { field1, field2 } = JSON.parse(event.body);
    if (!field1 || field1.trim() === '') {
      return errorResponse(400, 'Field1 is required');
    }
    
    // 3. Get environment variables
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME environment variable is not set');
    }
    
    // 4. Business logic
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const item = {
      id,
      field1,
      field2,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    // 5. Database operation
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });
    
    await ddbDocClient.send(command);
    
    // 6. Success response
    return successResponse(201, {
      message: 'Item created successfully',
      item,
    });
  } catch (error) {
    console.error('Error in handler:', error);
    
    return errorResponse(500, {
      message: 'Internal server error',
      error: error.message || 'Unknown error',
    });
  }
};

// Helper functions
const successResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  },
  body: JSON.stringify(body),
});

const errorResponse = (statusCode, message) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  },
  body: JSON.stringify({ message }),
});
```

**Rules:**
- Initialize AWS SDK clients at module level (cold start optimization)
- Use JSDoc comments for function documentation
- Follow 6-step handler pattern: validate, parse, config, logic, database, response
- Always wrap in try-catch
- Log errors with console.error
- Return consistent response format

### Protected Handler Pattern

```javascript
const { withAuth } = require('../../common/middleware');

/**
 * Protected handler - requires authentication
 * @param {Object} event - API Gateway event with user info added by middleware
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
    // Access authenticated user info
    const userId = event.user.id;
    const username = event.user.username;
    
    // Handler logic using user info
    
    return successResponse(200, { data });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

// Export wrapped with authentication middleware
exports.handler = withAuth(handler);
```

**Rules:**
- Use `withAuth` middleware for protected endpoints
- Access user info via `event.user.id` and `event.user.username`
- Export the wrapped handler, not the raw handler
- Keep raw handler as named function for clarity

### Authentication Middleware Pattern

```javascript
const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient();
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Authentication middleware for Lambda functions
 * @param {Function} handler - The Lambda handler function
 * @returns {Function} - The wrapped handler function with authentication
 */
const withAuth = (handler) => {
  return async (event) => {
    try {
      // 1. Extract token from Authorization header
      const authHeader = event.headers.Authorization || event.headers.authorization;
      if (!authHeader) {
        return unauthorizedResponse('Missing authorization token');
      }
      
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
      
      // 2. Decode JWT to extract username
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const username = payload['cognito:username'] || payload.username;
        
        if (username) {
          // 3. Look up user in DynamoDB
          const usersTableName = process.env.USERS_TABLE;
          const queryCommand = new QueryCommand({
            TableName: usersTableName,
            IndexName: 'username-index',
            KeyConditionExpression: 'username = :username',
            ExpressionAttributeValues: {
              ':username': username,
            },
          });
          
          const userResult = await ddbDocClient.send(queryCommand);
          
          if (userResult.Items && userResult.Items.length > 0) {
            const userId = userResult.Items[0].id || '';
            
            // 4. Add user info to event
            const authorizedEvent = {
              ...event,
              user: { id: userId, username },
            };
            
            // 5. Call original handler
            return await handler(authorizedEvent);
          }
        }
      }
      
      return unauthorizedResponse('Authentication failed');
    } catch (error) {
      console.error('Authentication error:', error);
      return unauthorizedResponse('Authentication failed');
    }
  };
};

module.exports = { withAuth };
```

## AWS SDK v3 Patterns

### DynamoDB Operations

#### Put Item
```javascript
const { PutCommand } = require('@aws-sdk/lib-dynamodb');

const command = new PutCommand({
  TableName: tableName,
  Item: {
    id: uuidv4(),
    field: value,
    createdAt: new Date().toISOString(),
  },
});

await ddbDocClient.send(command);
```

#### Get Item
```javascript
const { GetCommand } = require('@aws-sdk/lib-dynamodb');

const command = new GetCommand({
  TableName: tableName,
  Key: { id: itemId },
});

const result = await ddbDocClient.send(command);
const item = result.Item;
```

#### Query with GSI
```javascript
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

const command = new QueryCommand({
  TableName: tableName,
  IndexName: 'userId-index',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':userId': userId,
  },
  ScanIndexForward: false, // Sort descending
  Limit: 10,
});

const result = await ddbDocClient.send(command);
const items = result.Items || [];
```

#### Update Item
```javascript
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const command = new UpdateCommand({
  TableName: tableName,
  Key: { id: itemId },
  UpdateExpression: 'SET #field1 = :value1, #field2 = :value2, updatedAt = :timestamp',
  ExpressionAttributeNames: {
    '#field1': 'field1',
    '#field2': 'field2',
  },
  ExpressionAttributeValues: {
    ':value1': value1,
    ':value2': value2,
    ':timestamp': new Date().toISOString(),
  },
  ReturnValues: 'ALL_NEW',
});

const result = await ddbDocClient.send(command);
const updatedItem = result.Attributes;
```

#### Delete Item
```javascript
const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const command = new DeleteCommand({
  TableName: tableName,
  Key: { id: itemId },
});

await ddbDocClient.send(command);
```

#### Scan (Use Sparingly)
```javascript
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

const command = new ScanCommand({
  TableName: tableName,
  Limit: 100,
});

const result = await ddbDocClient.send(command);
const items = result.Items || [];
```

**Rules:**
- Use `DynamoDBDocumentClient` for simplified operations
- Always handle empty results (`result.Items || []`)
- Use Query over Scan whenever possible
- Include error handling for all operations
- Use ExpressionAttributeNames for reserved words

### Cognito Operations

#### Admin Create User
```javascript
const { CognitoIdentityProviderClient, AdminCreateUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient();

const command = new AdminCreateUserCommand({
  UserPoolId: userPoolId,
  Username: email,
  UserAttributes: [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'preferred_username', Value: username },
  ],
  TemporaryPassword: temporaryPassword,
  MessageAction: 'SUPPRESS',
});

await cognitoClient.send(command);
```

#### Admin Initiate Auth
```javascript
const { AdminInitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

const command = new AdminInitiateAuthCommand({
  UserPoolId: userPoolId,
  ClientId: clientId,
  AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
  AuthParameters: {
    USERNAME: email,
    PASSWORD: password,
  },
});

const response = await cognitoClient.send(command);
const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;
```

#### Get User
```javascript
const { GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const command = new GetUserCommand({
  AccessToken: token,
});

const response = await cognitoClient.send(command);
const attributes = response.UserAttributes;
```

## Response Patterns

### Success Responses

```javascript
// 200 OK - Successful GET
return {
  statusCode: 200,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Success',
    data: result,
  }),
};

// 201 Created - Successful POST
return {
  statusCode: 201,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Resource created successfully',
    resource: newResource,
  }),
};

// 204 No Content - Successful DELETE
return {
  statusCode: 204,
  headers: corsHeaders(),
  body: '',
};
```

### Error Responses

```javascript
// 400 Bad Request - Invalid input
return {
  statusCode: 400,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Validation error',
    error: 'Field is required',
  }),
};

// 401 Unauthorized - Authentication failed
return {
  statusCode: 401,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Authentication failed',
    error: error.message,
  }),
};

// 403 Forbidden - Insufficient permissions
return {
  statusCode: 403,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Forbidden',
    error: 'You do not have permission to perform this action',
  }),
};

// 404 Not Found - Resource not found
return {
  statusCode: 404,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Resource not found',
  }),
};

// 500 Internal Server Error
return {
  statusCode: 500,
  headers: corsHeaders(),
  body: JSON.stringify({
    message: 'Internal server error',
    error: error.message || 'Unknown error',
  }),
};
```

### CORS Headers

```javascript
const corsHeaders = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
});
```

**Rules:**
- Always include CORS headers in all responses
- Use consistent header structure
- Return JSON body for all responses except 204

## Environment Variables

```javascript
// Always validate environment variables
const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error('TABLE_NAME environment variable is not set');
}

// Common environment variables
const usersTable = process.env.USERS_TABLE;
const postsTable = process.env.POSTS_TABLE;
const userPoolId = process.env.USER_POOL_ID;
const clientId = process.env.USER_POOL_CLIENT_ID;
```

**Rules:**
- Validate all required environment variables
- Throw descriptive errors for missing variables
- Use UPPER_SNAKE_CASE for environment variable names

## Validation Patterns

```javascript
// Required field validation
if (!field || field.trim() === '') {
  return errorResponse(400, 'Field is required');
}

// Length validation
const MAX_LENGTH = 280;
if (content.length > MAX_LENGTH) {
  return errorResponse(400, `Content cannot exceed ${MAX_LENGTH} characters`);
}

// Format validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return errorResponse(400, 'Invalid email format');
}

// Type validation
if (typeof value !== 'string') {
  return errorResponse(400, 'Value must be a string');
}
```

## ID Generation

```javascript
const { v4: uuidv4 } = require('uuid');

// Generate unique IDs
const id = uuidv4();
```

**Rules:**
- Use uuid v4 for all ID generation
- Generate IDs in Lambda, not in DynamoDB

## Timestamp Patterns

```javascript
// ISO 8601 format
const timestamp = new Date().toISOString();

// Use for createdAt and updatedAt
const item = {
  id: uuidv4(),
  createdAt: timestamp,
  updatedAt: timestamp,
};
```

## Logging

```javascript
// Log important operations
console.log('Creating post for user:', userId);
console.log('Token received:', token.substring(0, 10) + '...');

// Log errors with context
console.error('Error creating post:', error);
console.error('Failed to query DynamoDB:', error.message);
```

**Rules:**
- Use console.log for informational messages
- Use console.error for errors
- Include context in log messages
- Sanitize sensitive data (tokens, passwords)

## File Organization

```
backend/src/
├── common/
│   └── middleware.js       # Shared middleware (withAuth)
└── functions/
    ├── auth/
    │   ├── login.js
    │   └── register.js
    ├── posts/
    │   ├── createPost.js
    │   ├── getPosts.js
    │   └── likePost.js
    ├── users/
    │   ├── getProfile.js
    │   ├── updateProfile.js
    │   ├── followUser.js
    │   └── unfollowUser.js
    └── comments/
        ├── createComment.js
        ├── getComments.js
        └── deleteComment.js
```

**Rules:**
- Group functions by domain
- One handler per file
- Use descriptive file names matching function purpose
- Keep middleware in common directory
