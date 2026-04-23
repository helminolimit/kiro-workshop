# JSDoc Documentation Guide

This guide provides comprehensive examples and best practices for JSDoc comments in the Micro Blogging App codebase.

## Quick Reference

### When JSDoc is Required ✅

1. **All exported functions** from any module
2. **Lambda handler functions** (especially those wrapped with `withAuth`)
3. **Middleware functions** (like `withAuth`)
4. **Custom React hooks** (e.g., `usePagination`, `useAuth`)
5. **Utility functions** used across multiple files
6. **Functions with complex parameters** or return types
7. **Functions that throw errors** (use `@throws` tag)

### When JSDoc is Optional ⚠️

1. **Private helper functions** within a module (but still recommended)
2. **Simple, self-explanatory functions** (e.g., `add(a, b)`)
3. **Component-internal event handlers** (e.g., `handleClick`)
4. **TypeScript functions** where types are already explicit

### When JSDoc is Not Required ❌

1. **React component definitions** (use TypeScript interfaces for props instead)
2. **Simple arrow functions** with obvious purpose
3. **Inline callback functions** (e.g., `.map(item => item.id)`)

## Complete Examples

### Lambda Handler Function

```javascript
/**
 * Creates a new post for the authenticated user.
 * 
 * Validates post content length and creates a new post entry in DynamoDB.
 * The post is automatically associated with the authenticated user.
 * 
 * @param {Object} event - API Gateway event object
 * @param {string} event.body - JSON string containing post data
 * @param {string} event.body.content - Post content (max 280 characters)
 * @param {Object} event.user - Authenticated user from withAuth middleware
 * @param {string} event.user.id - User's unique identifier (UUID)
 * @param {string} event.user.username - User's username
 * @returns {Promise<Object>} API Gateway response object
 * @returns {number} return.statusCode - HTTP status code (201 on success)
 * @returns {Object} return.headers - Response headers including CORS
 * @returns {string} return.body - JSON stringified response with created post
 * @throws {Error} If content exceeds MAX_POST_LENGTH (280 characters)
 * @throws {Error} If DynamoDB operation fails
 * 
 * @example
 * // Request body:
 * // { "content": "Hello, world!" }
 * // 
 * // Response (201):
 * // {
 * //   "post": {
 * //     "id": "uuid-here",
 * //     "userId": "user-uuid",
 * //     "content": "Hello, world!",
 * //     "createdAt": "2024-01-15T10:30:00Z",
 * //     "likesCount": 0,
 * //     "commentsCount": 0
 * //   }
 * // }
 */
exports.handler = withAuth(async (event) => {
  // Implementation
});
```

### Middleware Function

```javascript
/**
 * Authentication middleware that validates JWT tokens and attaches user info to the event.
 * 
 * This middleware:
 * 1. Extracts the JWT token from the Authorization header
 * 2. Decodes the token to get the username
 * 3. Queries DynamoDB to get the user's ID
 * 4. Attaches user info (id, username) to event.user
 * 5. Calls the wrapped handler with the enhanced event
 * 
 * @param {Function} handler - The Lambda handler function to wrap
 * @param {Object} handler.event - Enhanced event with user property
 * @param {Object} handler.event.user - User object added by middleware
 * @param {string} handler.event.user.id - User's unique identifier
 * @param {string} handler.event.user.username - User's username
 * @returns {Function} Wrapped handler function with authentication
 * @throws {Error} Returns 401 response if Authorization header is missing
 * @throws {Error} Returns 401 response if token is invalid or expired
 * @throws {Error} Returns 401 response if user not found in database
 * 
 * @example
 * // Protect a Lambda handler
 * exports.handler = withAuth(async (event) => {
 *   const userId = event.user.id; // User info available here
 *   const username = event.user.username;
 *   // Handler logic
 * });
 * 
 * @example
 * // The middleware expects this header format:
 * // Authorization: Bearer <jwt-token>
 */
function withAuth(handler) {
  return async (event) => {
    // Implementation
  };
}
```

### Utility Function (JavaScript)

```javascript
/**
 * Validates if a string matches a valid email format.
 * 
 * Uses a regex pattern to check for basic email structure:
 * - Local part (before @)
 * - @ symbol
 * - Domain part (after @)
 * - Top-level domain
 * 
 * Note: This is a basic validation and may not catch all edge cases.
 * For production use, consider a more robust email validation library.
 * 
 * @param {string} email - The email address to validate
 * @returns {boolean} True if the email matches valid format, false otherwise
 * 
 * @example
 * isValidEmail('user@example.com') // returns true
 * isValidEmail('user.name+tag@example.co.uk') // returns true
 * isValidEmail('invalid') // returns false
 * isValidEmail('missing@domain') // returns false
 * isValidEmail('@example.com') // returns false
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Formats a date string into a human-readable format.
 * 
 * @param {string} dateString - ISO 8601 date string (e.g., "2024-01-15T10:30:00Z")
 * @param {Object} [options] - Formatting options
 * @param {string} [options.locale='en-US'] - Locale for formatting (e.g., 'en-US', 'fr-FR')
 * @param {boolean} [options.includeTime=true] - Whether to include time in output
 * @returns {string} Formatted date string
 * @throws {Error} If dateString is not a valid date
 * 
 * @example
 * formatDate('2024-01-15T10:30:00Z')
 * // returns "1/15/2024, 10:30:00 AM"
 * 
 * @example
 * formatDate('2024-01-15T10:30:00Z', { includeTime: false })
 * // returns "1/15/2024"
 * 
 * @example
 * formatDate('2024-01-15T10:30:00Z', { locale: 'fr-FR' })
 * // returns "15/01/2024 10:30:00"
 */
function formatDate(dateString, options = {}) {
  const { locale = 'en-US', includeTime = true } = options;
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  
  return includeTime 
    ? date.toLocaleString(locale)
    : date.toLocaleDateString(locale);
}
```

### Custom React Hook (TypeScript)

```typescript
/**
 * Custom hook for managing paginated data fetching with infinite scroll support.
 * 
 * Handles loading states, error handling, and pagination tokens automatically.
 * Useful for implementing infinite scroll feeds or paginated lists.
 * 
 * @template T - The type of items being fetched
 * @param {() => Promise<PaginatedResponse<T>>} fetchFn - Async function to fetch data
 * @param {number} [pageSize=10] - Number of items to fetch per page
 * @returns {Object} Pagination state and controls
 * @returns {T[]} return.items - Array of all fetched items (accumulated across pages)
 * @returns {boolean} return.loading - Whether data is currently being fetched
 * @returns {string | null} return.error - Error message if fetch failed, null otherwise
 * @returns {() => void} return.loadMore - Function to load the next page of items
 * @returns {boolean} return.hasMore - Whether more items are available to load
 * @returns {() => void} return.reset - Function to reset pagination and clear items
 * 
 * @example
 * // Basic usage with posts
 * const { items, loading, loadMore, hasMore } = usePagination(
 *   () => postsApi.getPosts(token, { limit: 10 }),
 *   10
 * );
 * 
 * @example
 * // With infinite scroll
 * const { items, loading, loadMore, hasMore, error } = usePagination(
 *   () => postsApi.getPosts(token, { limit: 20, sortBy: 'popular' }),
 *   20
 * );
 * 
 * useEffect(() => {
 *   if (inView && hasMore && !loading) {
 *     loadMore();
 *   }
 * }, [inView, hasMore, loading]);
 */
function usePagination<T>(
  fetchFn: () => Promise<PaginatedResponse<T>>,
  pageSize: number = 10
): UsePaginationReturn<T> {
  // Implementation
}
```

### API Service Function (TypeScript)

```typescript
/**
 * Fetches a paginated list of posts from the API.
 * 
 * Supports sorting by newest or most popular, filtering by user,
 * and pagination using nextToken for infinite scroll.
 * 
 * @param {string} token - JWT authentication token
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=10] - Maximum number of posts to return (1-100)
 * @param {string} [options.nextToken] - Pagination token from previous response
 * @param {'newest' | 'popular'} [options.sortBy='newest'] - Sort order for posts
 * @param {string} [options.userId] - Filter posts by specific user ID
 * @returns {Promise<Object>} Response object
 * @returns {Post[]} return.posts - Array of post objects with user data
 * @returns {string | null} return.nextToken - Token for next page, null if no more pages
 * @throws {Error} If API request fails or returns non-200 status
 * 
 * @example
 * // Get first page of newest posts
 * const { posts, nextToken } = await postsApi.getPosts(token, {
 *   limit: 10,
 *   sortBy: 'newest'
 * });
 * 
 * @example
 * // Get next page using pagination token
 * const { posts, nextToken } = await postsApi.getPosts(token, {
 *   limit: 10,
 *   nextToken: previousNextToken
 * });
 * 
 * @example
 * // Get popular posts for specific user
 * const { posts } = await postsApi.getPosts(token, {
 *   limit: 20,
 *   sortBy: 'popular',
 *   userId: 'user-uuid-here'
 * });
 */
async function getPosts(
  token: string,
  options?: {
    limit?: number;
    nextToken?: string;
    sortBy?: 'newest' | 'popular';
    userId?: string;
  }
): Promise<{ posts: Post[]; nextToken: string | null }> {
  // Implementation
}
```

## JSDoc Tags Reference

### Essential Tags

- `@param {type} name - description` - Documents a function parameter
- `@returns {type} description` - Documents the return value
- `@throws {type} description` - Documents errors that may be thrown
- `@example` - Provides usage examples (can have multiple)

### Additional Useful Tags

- `@template T` - Documents generic type parameters (TypeScript)
- `@deprecated` - Marks a function as deprecated
- `@see` - References related functions or documentation
- `@since` - Documents when the function was added
- `@async` - Explicitly marks async functions (usually inferred)
- `@private` - Marks internal/private functions

## Best Practices

### 1. Be Specific with Types

```javascript
// ❌ Vague
/**
 * @param {Object} data - The data
 */

// ✅ Specific
/**
 * @param {Object} data - User profile data
 * @param {string} data.displayName - User's display name
 * @param {string} data.bio - User's biography (max 160 chars)
 * @param {string} [data.avatarUrl] - Optional avatar image URL
 */
```

### 2. Include Examples for Complex Functions

```javascript
// ✅ Good - includes examples
/**
 * Calculates pagination offset and limit for DynamoDB queries.
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} Pagination parameters
 * @example
 * getPaginationParams(1, 10) // returns { offset: 0, limit: 10 }
 * getPaginationParams(3, 20) // returns { offset: 40, limit: 20 }
 */
```

### 3. Document Error Conditions

```javascript
// ✅ Good - documents what can go wrong
/**
 * Deletes a post by ID.
 * @param {string} postId - Post UUID
 * @param {string} token - Auth token
 * @throws {Error} If post not found (404)
 * @throws {Error} If user is not the post author (403)
 * @throws {Error} If token is invalid (401)
 */
```

### 4. Use Optional Parameters Correctly

```javascript
// ✅ Good - shows optional params with [brackets]
/**
 * @param {string} userId - Required user ID
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.limit=10] - Optional limit with default
 */
```

### 5. Document Object Structures

```javascript
// ✅ Good - documents nested object properties
/**
 * @returns {Object} API Gateway response
 * @returns {number} return.statusCode - HTTP status code
 * @returns {Object} return.headers - Response headers
 * @returns {string} return.headers.Content-Type - Content type header
 * @returns {string} return.body - JSON stringified response body
 */
```

## Code Review Checklist

When reviewing code for JSDoc compliance, check:

- [ ] All exported functions have JSDoc comments
- [ ] All parameters are documented with types
- [ ] Return values are documented with types
- [ ] Error conditions are documented with `@throws`
- [ ] Complex functions include `@example` tags
- [ ] Optional parameters use `[brackets]` notation
- [ ] Default values are documented (e.g., `[limit=10]`)
- [ ] Object properties are documented when relevant
- [ ] JSDoc matches actual function signature
- [ ] Examples are accurate and helpful

## Common Mistakes to Avoid

### ❌ Incomplete Parameter Documentation

```javascript
/**
 * Creates a user
 * @param data - User data
 */
function createUser(data) { }
```

### ✅ Complete Parameter Documentation

```javascript
/**
 * Creates a new user in the database.
 * @param {Object} data - User registration data
 * @param {string} data.username - Unique username (3-20 chars)
 * @param {string} data.email - Valid email address
 * @param {string} data.password - Password (min 8 chars)
 * @returns {Promise<User>} Created user object
 */
function createUser(data) { }
```

---

For more examples, see the `reference.md` file in this directory.
