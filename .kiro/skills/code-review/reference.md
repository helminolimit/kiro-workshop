# Code Review Reference Guide

This document provides detailed standards and patterns for the Micro Blogging App codebase.

## Naming Conventions

### Variables and Functions
- **Format**: camelCase
- **Examples**: `getUserProfile`, `postId`, `isFollowing`, `handleSubmit`
- **Pattern**: Use verb prefixes for functions (`get`, `set`, `create`, `update`, `delete`, `handle`, `fetch`)

### React Components and Classes
- **Format**: PascalCase
- **Examples**: `CommentThread`, `AuthContext`, `ErrorBoundary`, `CreatePost`
- **Pattern**: Use nouns or noun phrases that describe what the component represents

### Constants
- **Format**: UPPER_SNAKE_CASE
- **Examples**: `MAX_POST_LENGTH`, `API_BASE_URL`, `DEFAULT_PAGE_SIZE`
- **Usage**: For values that never change and are used across multiple files

### Files
- **Components**: PascalCase matching the component name (`CommentThread.tsx`)
- **Utilities**: camelCase matching the primary export (`api.ts`, `middleware.js`)
- **Types**: camelCase with descriptive names (`user.ts`, `post.ts`, `comment.ts`)

### AWS Resources (CDK)
- **Construct IDs**: PascalCase with descriptive suffixes
  - Tables: `UsersTable`, `PostsTable`
  - Functions: `CreatePostFunction`, `GetProfileFunction`
  - APIs: `MicroBlogApi`
  - Buckets: `FrontendBucket`

## Error Handling Patterns

### Lambda Handlers

**Standard Pattern**:
```javascript
exports.handler = async (event) => {
  try {
    // 1. Parse input
    const body = JSON.parse(event.body || '{}');
    
    // 2. Validate required fields
    if (!body.requiredField) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Missing required field: requiredField' 
        }),
      };
    }
    
    // 3. Business logic
    const result = await performOperation(body);
    
    // 4. Success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
    
  } catch (error) {
    console.error('Error in handler:', error);
    
    // 5. Error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error' 
      }),
    };
  }
};
```

**Key Points**:
- Always wrap in try-catch
- Parse `event.body` safely
- Validate inputs before processing
- Return consistent response structure
- Log errors with context
- Sanitize error messages (don't expose internal details)

### React Components

**Standard Pattern**:
```typescript
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await api.getData();
        setData(result);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return <div>{/* Render data */}</div>;
};
```

**Key Points**:
- Maintain loading, error, and data states
- Handle all async operations with try-catch
- Show user-friendly error messages
- Provide loading indicators
- Handle null/undefined data gracefully

## HTTP Status Codes

Use these consistently across all Lambda handlers:

- **200 OK**: Successful GET, PUT, or DELETE
- **201 Created**: Successful POST that creates a resource
- **400 Bad Request**: Invalid input, missing required fields
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Authenticated but not authorized for this action
- **404 Not Found**: Resource doesn't exist
- **500 Internal Server Error**: Unexpected server error

## CORS Headers

All Lambda responses must include:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}
```

API Gateway handles preflight OPTIONS requests, but Lambda responses need these headers.

## Input Validation Patterns

### Required Field Validation
```javascript
const requiredFields = ['field1', 'field2', 'field3'];
const missingFields = requiredFields.filter(field => !body[field]);

if (missingFields.length > 0) {
  return {
    statusCode: 400,
    headers: { /* CORS headers */ },
    body: JSON.stringify({ 
      error: `Missing required fields: ${missingFields.join(', ')}` 
    }),
  };
}
```

### Type Validation
```javascript
if (typeof body.age !== 'number') {
  return {
    statusCode: 400,
    headers: { /* CORS headers */ },
    body: JSON.stringify({ error: 'Age must be a number' }),
  };
}
```

### Format Validation
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(body.email)) {
  return {
    statusCode: 400,
    headers: { /* CORS headers */ },
    body: JSON.stringify({ error: 'Invalid email format' }),
  };
}
```

### Length Validation
```javascript
const MAX_POST_LENGTH = 280;
if (body.content.length > MAX_POST_LENGTH) {
  return {
    statusCode: 400,
    headers: { /* CORS headers */ },
    body: JSON.stringify({ 
      error: `Post content exceeds maximum length of ${MAX_POST_LENGTH} characters` 
    }),
  };
}
```

## AWS SDK v3 Patterns

### DynamoDB Document Client Setup
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
```

### Put Item
```javascript
await docClient.send(new PutCommand({
  TableName: process.env.TABLE_NAME,
  Item: {
    id: itemId,
    // other fields
  },
}));
```

### Get Item
```javascript
const result = await docClient.send(new GetCommand({
  TableName: process.env.TABLE_NAME,
  Key: { id: itemId },
}));

const item = result.Item;
```

### Query with GSI
```javascript
const result = await docClient.send(new QueryCommand({
  TableName: process.env.TABLE_NAME,
  IndexName: 'username-index',
  KeyConditionExpression: 'username = :username',
  ExpressionAttributeValues: {
    ':username': username,
  },
}));

const items = result.Items || [];
```

## Accessibility Patterns

### Form Labels
```tsx
<label htmlFor="email">Email</label>
<input 
  id="email" 
  type="email" 
  aria-required="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">{error}</span>
```

### Buttons
```tsx
<button 
  type="button"
  aria-label="Like post"
  onClick={handleLike}
>
  ❤️
</button>
```

### Navigation
```tsx
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/feed">Feed</a></li>
    <li><a href="/profile">Profile</a></li>
  </ul>
</nav>
```

### Loading States
```tsx
<div role="status" aria-live="polite">
  {loading ? 'Loading...' : 'Content loaded'}
</div>
```

## TypeScript Patterns

### Component Props
```typescript
interface CommentThreadProps {
  postId: string;
  initialComments?: Comment[];
  onCommentAdded?: (comment: Comment) => void;
}

const CommentThread: React.FC<CommentThreadProps> = ({ 
  postId, 
  initialComments = [], 
  onCommentAdded 
}) => {
  // component logic
};
```

### API Response Types
```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchUser(userId: string): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: 'Failed to fetch user' };
  }
}
```

### Event Handlers
```typescript
const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  // handle form submission
};

const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  setValue(event.target.value);
};
```

## JSDoc Comment Patterns

### Lambda Handler Functions
```javascript
/**
 * Creates a new post for the authenticated user.
 * 
 * @param {Object} event - API Gateway event object
 * @param {string} event.body - JSON string with post content
 * @param {Object} event.user - Authenticated user from withAuth middleware
 * @param {string} event.user.id - User's unique identifier
 * @param {string} event.user.username - User's username
 * @returns {Promise<Object>} API Gateway response object
 * @returns {number} return.statusCode - HTTP status code
 * @returns {Object} return.headers - Response headers including CORS
 * @returns {string} return.body - JSON stringified response body
 * @throws {Error} If content exceeds MAX_POST_LENGTH
 */
exports.handler = withAuth(async (event) => {
  // Implementation
});
```

### Utility Functions (JavaScript)
```javascript
/**
 * Validates if a string matches email format.
 * 
 * @param {string} email - The email address to validate
 * @returns {boolean} True if valid email format, false otherwise
 * @example
 * isValidEmail('user@example.com') // returns true
 * isValidEmail('invalid') // returns false
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Formats a date string into a human-readable format.
 * 
 * @param {string} dateString - ISO 8601 date string
 * @param {Object} [options] - Formatting options
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @param {boolean} [options.includeTime=true] - Whether to include time
 * @returns {string} Formatted date string
 * @throws {Error} If dateString is not a valid date
 * @example
 * formatDate('2024-01-15T10:30:00Z') // returns "1/15/2024, 10:30:00 AM"
 * formatDate('2024-01-15T10:30:00Z', { includeTime: false }) // returns "1/15/2024"
 */
function formatDate(dateString, options = {}) {
  const { locale = 'en-US', includeTime = true } = options;
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  
  return includeTime 
    ? date.toLocaleString(locale)
    : date.toLocaleDateString(locale);
}
```

### Custom React Hooks (TypeScript)
```typescript
/**
 * Custom hook for managing paginated data fetching.
 * 
 * @template T - The type of items being fetched
 * @param {() => Promise<PaginatedResponse<T>>} fetchFn - Function to fetch data
 * @param {number} [pageSize=10] - Number of items per page
 * @returns {Object} Pagination state and controls
 * @returns {T[]} return.items - Array of fetched items
 * @returns {boolean} return.loading - Whether data is currently loading
 * @returns {string | null} return.error - Error message if fetch failed
 * @returns {() => void} return.loadMore - Function to load next page
 * @returns {boolean} return.hasMore - Whether more items are available
 * @example
 * const { items, loading, loadMore, hasMore } = usePagination(
 *   () => postsApi.getPosts(token, { limit: 10 }),
 *   10
 * );
 */
function usePagination<T>(
  fetchFn: () => Promise<PaginatedResponse<T>>,
  pageSize: number = 10
) {
  // Implementation
}
```

### Middleware Functions
```javascript
/**
 * Authentication middleware that validates JWT tokens and attaches user info to event.
 * 
 * @param {Function} handler - The Lambda handler function to wrap
 * @returns {Function} Wrapped handler with authentication
 * @throws {Error} If Authorization header is missing
 * @throws {Error} If token is invalid or expired
 * @example
 * exports.handler = withAuth(async (event) => {
 *   const userId = event.user.id; // User info available here
 *   // Handler logic
 * });
 */
function withAuth(handler) {
  return async (event) => {
    // Validate token and attach user to event
    // Call handler with authenticated event
  };
}
```

### When JSDoc is Required vs Optional

**Required:**
- ✅ All exported functions from modules
- ✅ Lambda handler functions
- ✅ Middleware functions
- ✅ Custom React hooks
- ✅ Utility functions used across multiple files
- ✅ Functions with complex parameters or return types
- ✅ Functions that throw errors

**Optional (but recommended):**
- ⚠️ Private helper functions within a module
- ⚠️ Simple, self-explanatory functions (e.g., `add(a, b)`)
- ⚠️ Component-internal event handlers
- ⚠️ TypeScript functions where types are already explicit

**Not Required:**
- ❌ React component definitions (use TypeScript interfaces instead)
- ❌ Simple arrow functions assigned to constants with obvious purpose
- ❌ Inline callback functions

## Common Anti-Patterns to Flag

### ❌ Avoid
```javascript
// Hardcoded values
const API_URL = 'https://api.example.com';

// Missing error handling
const data = await fetchData();

// Using any type
const handleClick = (event: any) => { };

// Prop drilling
<Child1 user={user}>
  <Child2 user={user}>
    <Child3 user={user} />
  </Child2>
</Child1>

// Missing validation
const { email } = JSON.parse(event.body);
await saveEmail(email);

// Debug console.log statements
console.log('User data:', userData);
console.log('Making API call...');
console.log('Response:', response);

// Missing JSDoc on exported function
export function calculateDiscount(price, percentage) {
  return price * (percentage / 100);
}
```

### ✅ Prefer
```javascript
// Environment variables
const API_URL = process.env.VITE_API_URL;

// Proper error handling
try {
  const data = await fetchData();
} catch (error) {
  console.error('Fetch failed:', error);
}

// Specific types
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => { };

// Context for shared state
<AuthContext.Provider value={user}>
  <Child1 />
</AuthContext.Provider>

// Input validation
const body = JSON.parse(event.body || '{}');
if (!body.email || !isValidEmail(body.email)) {
  return { statusCode: 400, /* ... */ };
}
await saveEmail(body.email);

// Proper error logging (acceptable in Lambda handlers)
catch (error) {
  console.error('Error processing request:', error);
  // Return error response
}

// JSDoc on exported function
/**
 * Calculates the discount amount for a given price and percentage.
 * @param {number} price - The original price
 * @param {number} percentage - The discount percentage (0-100)
 * @returns {number} The discount amount
 * @example
 * calculateDiscount(100, 20) // returns 20
 */
export function calculateDiscount(price, percentage) {
  return price * (percentage / 100);
}
```

## Console Statement Guidelines

### Acceptable Usage
- **Lambda Handlers**: `console.error()` for errors, `console.log()` for important operations (create, update, delete)
- **Error Boundaries**: `console.error()` for caught errors
- **Development**: Temporary debugging during active development

### Should Be Removed
- **React Components**: `console.log()` for debugging state or props
- **API Services**: `console.log()` for request/response logging (unless specifically for debugging)
- **Utilities**: Any `console.log()` statements
- **General**: Any console statement that doesn't provide production value

### Example Review Comments
```markdown
⚠️ **Line 45** - Remove debug console.log statement
- `console.log('User data:', userData);`
- **Why it matters**: Debug logging clutters production logs and may expose sensitive data
- **Suggested fix**: Remove this line or replace with proper logging library

✅ **Line 78** - Appropriate error logging
- `console.error('Failed to fetch user:', error);`
- This is acceptable for production error tracking
```

## Security Checklist

- [ ] No hardcoded credentials or API keys
- [ ] User input is validated and sanitized
- [ ] Authentication is required for protected routes
- [ ] User IDs come from JWT token, not request body
- [ ] Error messages don't expose sensitive information
- [ ] CORS headers are properly configured
- [ ] SQL injection not possible (using DynamoDB with proper params)
- [ ] XSS not possible (React escapes by default, but check dangerouslySetInnerHTML)

## Performance Checklist

- [ ] No unnecessary re-renders (check useEffect dependencies)
- [ ] Large lists use pagination or virtualization
- [ ] Images have appropriate sizes and formats
- [ ] API calls are debounced where appropriate
- [ ] DynamoDB queries use indexes for efficient lookups
- [ ] Lambda functions have appropriate memory/timeout settings
- [ ] Frontend bundles are code-split and optimized
