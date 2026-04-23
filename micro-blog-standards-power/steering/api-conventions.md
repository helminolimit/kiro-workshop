# API Conventions

## REST Endpoint Design

### Endpoint Naming Standards

#### Resource-Based URLs
```
/auth/register          POST    - Create new user account
/auth/login             POST    - Authenticate user

/users/{userId}         GET     - Get user profile
/users/{userId}         PUT     - Update user profile
/users/{userId}/follow  POST    - Follow a user
/users/{userId}/unfollow POST   - Unfollow a user
/users/{userId}/following GET   - Check if following user

/posts                  GET     - List posts (with query params)
/posts                  POST    - Create new post
/posts/{postId}         GET     - Get single post
/posts/{postId}         PUT     - Update post
/posts/{postId}         DELETE  - Delete post
/posts/{postId}/like    POST    - Like a post
/posts/{postId}/unlike  POST    - Unlike a post

/posts/{postId}/comments        GET     - List comments on post
/posts/{postId}/comments        POST    - Create comment on post
/posts/{postId}/comments/{commentId} DELETE - Delete comment
```

**Rules:**
- Use plural nouns for collections (`/posts`, `/users`, `/comments`)
- Use path parameters for resource IDs (`{userId}`, `{postId}`)
- Use nested resources for relationships (`/posts/{postId}/comments`)
- Use action verbs only for non-CRUD operations (`/follow`, `/like`)
- Use lowercase with hyphens for multi-word resources
- Keep URLs short and intuitive

### HTTP Methods

```
GET     - Retrieve resource(s)
POST    - Create new resource or trigger action
PUT     - Update existing resource (full update)
PATCH   - Partial update (not currently used)
DELETE  - Remove resource
```

**Rules:**
- GET requests should be idempotent and safe
- POST for creation and actions
- PUT for full updates
- DELETE for removal
- Use appropriate method for semantic meaning

### Query Parameters

```
GET /posts?limit=10&sortBy=newest&nextToken=abc123
GET /posts?userId=user123&limit=20
GET /users?username=john
```

**Rules:**
- Use camelCase for query parameter names
- Common parameters:
  - `limit` - Number of items to return
  - `nextToken` - Pagination token
  - `sortBy` - Sort order (newest, popular)
  - `userId` - Filter by user
- Document all query parameters
- Provide sensible defaults

## Request Format Standards

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Rules:**
- Always use `application/json` for request body
- Include `Authorization: Bearer <token>` for protected endpoints
- Token should be JWT IdToken from Cognito

### Request Body Format

#### Authentication Requests
```json
// POST /auth/register
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "displayName": "John Doe"
}

// POST /auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Resource Creation
```json
// POST /posts
{
  "content": "This is my post content"
}

// POST /posts/{postId}/comments
{
  "content": "This is my comment"
}
```

#### Resource Updates
```json
// PUT /users/{userId}
{
  "displayName": "John Smith",
  "bio": "Software developer"
}
```

**Rules:**
- Use camelCase for JSON keys
- Keep request bodies minimal
- Only include fields that can be modified
- Validate all input on backend
- Reject unknown fields

## Response Format Standards

### Success Response Structure

#### Single Resource
```json
{
  "message": "Success message",
  "resource": {
    "id": "uuid",
    "field1": "value1",
    "field2": "value2",
    "createdAt": "2026-04-23T10:30:00.000Z",
    "updatedAt": "2026-04-23T10:30:00.000Z"
  }
}
```

#### Collection
```json
{
  "message": "Success message",
  "resources": [
    { "id": "1", "field": "value" },
    { "id": "2", "field": "value" }
  ],
  "nextToken": "pagination-token-or-null"
}
```

#### Action Response
```json
{
  "message": "Action completed successfully",
  "result": {
    "status": "success",
    "data": {}
  }
}
```

### Response Examples

#### Login Response
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-string",
  "user": {
    "id": "user-uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe"
  }
}
```

#### Post Creation Response
```json
{
  "message": "Post created successfully",
  "post": {
    "id": "post-uuid",
    "userId": "user-uuid",
    "content": "Post content here",
    "createdAt": "2026-04-23T10:30:00.000Z",
    "updatedAt": "2026-04-23T10:30:00.000Z",
    "likesCount": 0,
    "commentsCount": 0
  }
}
```

#### Get Posts Response
```json
{
  "posts": [
    {
      "id": "post-uuid-1",
      "userId": "user-uuid",
      "content": "First post",
      "createdAt": "2026-04-23T10:30:00.000Z",
      "updatedAt": "2026-04-23T10:30:00.000Z",
      "likesCount": 5,
      "commentsCount": 2
    },
    {
      "id": "post-uuid-2",
      "userId": "user-uuid",
      "content": "Second post",
      "createdAt": "2026-04-23T10:25:00.000Z",
      "updatedAt": "2026-04-23T10:25:00.000Z",
      "likesCount": 3,
      "commentsCount": 1
    }
  ],
  "nextToken": "pagination-token-or-null"
}
```

#### User Profile Response
```json
{
  "user": {
    "id": "user-uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "bio": "Software developer",
    "followersCount": 42,
    "followingCount": 38,
    "createdAt": "2026-01-15T08:00:00.000Z"
  }
}
```

### Error Response Structure

```json
{
  "message": "Human-readable error message",
  "error": "Detailed error information"
}
```

### Error Response Examples

#### 400 Bad Request
```json
{
  "message": "Validation error",
  "error": "Post content cannot exceed 280 characters"
}

{
  "message": "Missing request body"
}

{
  "message": "Post content cannot be empty"
}
```

#### 401 Unauthorized
```json
{
  "message": "Authentication failed",
  "error": "Invalid or expired token"
}

{
  "message": "Missing authorization token"
}
```

#### 403 Forbidden
```json
{
  "message": "Forbidden",
  "error": "You do not have permission to perform this action"
}
```

#### 404 Not Found
```json
{
  "message": "Resource not found",
  "error": "User with ID user-123 not found"
}

{
  "message": "Post not found"
}
```

#### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "error": "Database connection failed"
}

{
  "message": "Error creating post",
  "error": "Unknown error"
}
```

## Status Code Standards

### Success Codes
- **200 OK** - Successful GET, PUT, or action
- **201 Created** - Successful POST that creates a resource
- **204 No Content** - Successful DELETE

### Client Error Codes
- **400 Bad Request** - Invalid input, validation error
- **401 Unauthorized** - Missing or invalid authentication
- **403 Forbidden** - Authenticated but insufficient permissions
- **404 Not Found** - Resource does not exist

### Server Error Codes
- **500 Internal Server Error** - Unexpected server error

**Rules:**
- Use appropriate status code for the situation
- Be consistent across all endpoints
- Include descriptive error messages
- Log server errors for debugging

## CORS Configuration

### Headers
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

**Rules:**
- Enable CORS for all API endpoints
- Allow all origins in development (`*`)
- Restrict origins in production
- Include credentials support
- Handle OPTIONS preflight requests

## Authentication

### Header Format
```
Authorization: Bearer <jwt-token>
```

### Token Usage
- Use Cognito IdToken (not AccessToken)
- Token contains user claims (username, email)
- Backend decodes JWT to extract user info
- Middleware validates and adds user to request

### Protected Endpoints
All endpoints except `/auth/register` and `/auth/login` require authentication.

## Pagination

### Request
```
GET /posts?limit=10&nextToken=abc123
```

### Response
```json
{
  "posts": [...],
  "nextToken": "next-page-token-or-null"
}
```

**Rules:**
- Use `limit` query parameter for page size
- Use `nextToken` for cursor-based pagination
- Return `null` for `nextToken` when no more pages
- Default limit: 10 items
- Maximum limit: 100 items

## Timestamps

### Format
```
ISO 8601: "2026-04-23T10:30:00.000Z"
```

**Rules:**
- Always use ISO 8601 format
- Always use UTC timezone
- Include milliseconds
- Use for `createdAt` and `updatedAt` fields

## Field Naming

### Conventions
- Use camelCase for all JSON fields
- Use descriptive names
- Be consistent across resources

### Common Fields
```
id              - Unique identifier (UUID)
userId          - User identifier
postId          - Post identifier
content         - Text content
createdAt       - Creation timestamp
updatedAt       - Last update timestamp
likesCount      - Number of likes
commentsCount   - Number of comments
followersCount  - Number of followers
followingCount  - Number following
displayName     - User's display name
username        - User's unique username
email           - User's email address
bio             - User biography
```

## Validation Rules

### Post Content
- Required: Yes
- Min length: 1 character
- Max length: 280 characters
- Type: String

### Comment Content
- Required: Yes
- Min length: 1 character
- Max length: 500 characters
- Type: String

### Username
- Required: Yes
- Min length: 3 characters
- Max length: 30 characters
- Pattern: Alphanumeric and underscore
- Unique: Yes

### Email
- Required: Yes
- Format: Valid email address
- Unique: Yes

### Password
- Min length: 8 characters
- Require: Uppercase, lowercase, digit
- No symbol requirement

### Display Name
- Required: Yes
- Min length: 1 character
- Max length: 50 characters

## API Documentation

### Endpoint Documentation Template
```
Endpoint: POST /resource
Description: Brief description of what this endpoint does
Authentication: Required/Not Required
Request Body:
  - field1 (string, required): Description
  - field2 (number, optional): Description
Response: 201 Created
  - Success response structure
Errors:
  - 400: Validation error
  - 401: Unauthorized
  - 500: Server error
```

## Best Practices

1. **Consistency**: Use same patterns across all endpoints
2. **Clarity**: Clear, descriptive error messages
3. **Validation**: Validate all input on backend
4. **Security**: Always validate authentication
5. **Logging**: Log all requests and errors
6. **Documentation**: Keep API docs up to date
7. **Versioning**: Consider API versioning for breaking changes
8. **Testing**: Test all endpoints thoroughly
