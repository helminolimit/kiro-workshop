# Code Review: createPost.js

**File Type**: Lambda Handler

## Critical Issues ❌

### Missing Input Validation

- **backend/src/functions/posts/createPost.js:15** - No validation for post content length
  - **Why it matters**: Users could create posts exceeding the 280 character limit, violating product requirements and potentially causing UI issues
  - **Suggested fix**:
    ```javascript
    const MAX_POST_LENGTH = 280;
    if (!content || content.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { /* CORS */ },
        body: JSON.stringify({ error: 'Post content is required' }),
      };
    }
    if (content.length > MAX_POST_LENGTH) {
      return {
        statusCode: 400,
        headers: { /* CORS */ },
        body: JSON.stringify({ 
          error: `Post content exceeds maximum length of ${MAX_POST_LENGTH} characters` 
        }),
      };
    }
    ```

### Exposed Internal Error Details

- **backend/src/functions/posts/createPost.js:45** - Error response includes full error stack
  - **Why it matters**: Exposing internal error details is a security risk that could reveal system architecture to attackers
  - **Suggested fix**:
    ```javascript
    catch (error) {
      console.error('Error creating post:', error); // Log full error
      return {
        statusCode: 500,
        headers: { /* CORS */ },
        body: JSON.stringify({ error: 'Internal server error' }), // Generic message
      };
    }
    ```

## Warnings ⚠️

### Inconsistent Status Code

- **backend/src/functions/posts/createPost.js:38** - Returns 200 instead of 201 for resource creation
  - **Why it matters**: REST API conventions use 201 Created for successful POST requests that create resources
  - **Suggested fix**: Change `statusCode: 200` to `statusCode: 201`

### Missing Timestamp Index

- **backend/src/functions/posts/createPost.js:28** - Post timestamp not optimized for queries
  - **Why it matters**: Fetching posts by date will require full table scans without a GSI on timestamp
  - **Suggested fix**: Ensure the Posts table has a GSI on `createdAt` field (infrastructure change needed)

## Suggestions 💡

### Extract Validation Logic

- **backend/src/functions/posts/createPost.js:12-20** - Validation logic could be reused
  - **Why it matters**: Multiple handlers will need similar validation; extracting to a utility reduces duplication
  - **Suggested fix**: Create `backend/src/common/validation.js`:
    ```javascript
    exports.validatePostContent = (content) => {
      const MAX_POST_LENGTH = 280;
      if (!content || content.trim().length === 0) {
        return { valid: false, error: 'Post content is required' };
      }
      if (content.length > MAX_POST_LENGTH) {
        return { 
          valid: false, 
          error: `Post content exceeds maximum length of ${MAX_POST_LENGTH} characters` 
        };
      }
      return { valid: true };
    };
    ```

### Add Logging for Analytics

- **backend/src/functions/posts/createPost.js:35** - No logging of successful post creation
  - **Why it matters**: Logging successful operations helps with analytics and debugging
  - **Suggested fix**:
    ```javascript
    console.log('Post created:', { 
      postId: post.id, 
      userId: event.user.id,
      timestamp: post.createdAt 
    });
    ```

### Consider Rate Limiting

- **backend/src/functions/posts/createPost.js** - No rate limiting on post creation
  - **Why it matters**: Users could spam posts, degrading service quality
  - **Suggested fix**: Implement rate limiting using DynamoDB to track posts per user per time window, or use API Gateway usage plans

## Passed Checks ✅

- ✅ Uses `withAuth` middleware for authentication
- ✅ Accesses user ID from `event.user.id` (not request body)
- ✅ Uses AWS SDK v3 with modular imports
- ✅ Uses `DynamoDBDocumentClient` for simplified operations
- ✅ Includes CORS headers in response
- ✅ Uses `uuid` for generating post IDs
- ✅ Reads table name from environment variable
- ✅ Has try-catch error handling (though error response needs improvement)
- ✅ Returns proper response structure with statusCode, headers, and body

## Summary

The handler follows most best practices but has **2 critical issues** that must be fixed before deployment:
1. Missing content length validation (product requirement violation)
2. Exposed error details (security risk)

**Priority**: Fix critical issues immediately. The warnings and suggestions can be addressed in follow-up work.

**Estimated effort**: 15-30 minutes to fix critical issues and warnings.
