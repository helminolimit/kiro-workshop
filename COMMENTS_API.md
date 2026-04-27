# Comments API Documentation

## Quick Start

The Comments API allows authenticated users to create, retrieve, and delete comments on posts. All endpoints require a valid JWT token from AWS Cognito.

**Base URL**: `https://your-api-gateway-url.amazonaws.com/prod`

**Authentication**: Include your Cognito IdToken in the `Authorization` header:
```bash
Authorization: Bearer <your-cognito-id-token>
```

**Quick Example**:
```bash
# Create a comment
curl -X POST https://your-api-url.com/prod/posts/{postId}/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Great post!"}'
```

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Create Comment](#create-comment)
  - [Get Comments](#get-comments)
  - [Delete Comment](#delete-comment)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Business Rules](#business-rules)
- [Best Practices](#best-practices)

---

## Authentication

All comment endpoints require authentication via AWS Cognito JWT tokens.

### Getting Your Token

After logging in via the `/auth/login` endpoint, you'll receive an IdToken:

```bash
curl -X POST https://your-api-url.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123!"
  }'
```

**Response**:
```json
{
  "token": "eyJraWQiOiJ...",
  "user": {
    "id": "u9876543-21fe-dcba-0987-654321fedcba",
    "username": "johndoe",
    "email": "user@example.com"
  }
}
```

Use the `token` value in all subsequent requests:
```bash
Authorization: Bearer eyJraWQiOiJ...
```

### Token Validation

The API automatically:
- Validates the JWT signature with Cognito
- Extracts `userId` and `username` from the token
- Attaches user information to the request context

If your token is invalid or expired, you'll receive a `401 Unauthorized` error.

---

## Endpoints

### Create Comment

Create a new comment on a post.

**Endpoint**: `POST /posts/{postId}/comments`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postId` | string (UUID) | Yes | The ID of the post to comment on |

**Request Body**:
```json
{
  "content": "Your comment text here"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `content` | string | Yes | 1-280 characters | The comment text |

**Example Request**:
```bash
curl -X POST https://your-api-url.com/prod/posts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great post! I totally agree with your perspective."
  }'
```

**Success Response** (`201 Created`):
```json
{
  "comment": {
    "id": "c7d8e9f0-1234-5678-90ab-cdef12345678",
    "postId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "u9876543-21fe-dcba-0987-654321fedcba",
    "username": "johndoe",
    "content": "Great post! I totally agree with your perspective.",
    "createdAt": "2024-01-15T10:30:45.123Z"
  }
}
```

**Error Responses**:

| Status Code | Scenario | Response Body |
|-------------|----------|---------------|
| `400` | Empty content | `{"message": "Comment content cannot be empty"}` |
| `400` | Content too long | `{"message": "Comment content cannot exceed 280 characters"}` |
| `400` | Invalid JSON | `{"message": "Invalid JSON in request body"}` |
| `401` | Missing/invalid token | `{"message": "Missing authorization token"}` |
| `404` | Post not found | `{"message": "Post not found"}` |
| `500` | Server error | `{"message": "Internal server error", "error": "..."}` |

**What Happens Behind the Scenes**:
1. The API validates your token and extracts your user ID and username
2. It checks that the post exists (returns 404 if not)
3. It creates the comment with a unique UUID
4. It atomically increments the post's `commentsCount` field
5. If anything fails, it rolls back the counter increment

---

### Get Comments

Retrieve all comments for a specific post.

**Endpoint**: `GET /posts/{postId}/comments`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postId` | string (UUID) | Yes | The ID of the post whose comments to retrieve |

**Example Request**:
```bash
curl -X GET https://your-api-url.com/prod/posts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/comments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (`200 OK`):
```json
{
  "comments": [
    {
      "id": "c7d8e9f0-1234-5678-90ab-cdef12345678",
      "postId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "u9876543-21fe-dcba-0987-654321fedcba",
      "username": "johndoe",
      "content": "Great post! I totally agree with your perspective.",
      "createdAt": "2024-01-15T10:30:45.123Z"
    },
    {
      "id": "d8e9f0a1-2345-6789-0abc-def123456789",
      "postId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "u1234567-89ab-cdef-0123-456789abcdef",
      "username": "janedoe",
      "content": "Thanks for sharing this insight!",
      "createdAt": "2024-01-15T11:15:22.456Z"
    }
  ]
}
```

**Empty Response** (post with no comments):
```json
{
  "comments": []
}
```

**Response Details**:
- Comments are sorted by `createdAt` in **ascending order** (oldest first)
- Returns an empty array if the post has no comments
- All comments include the author's username for display purposes

**Error Responses**:

| Status Code | Scenario | Response Body |
|-------------|----------|---------------|
| `400` | Missing post ID | `{"message": "Missing post ID"}` |
| `401` | Missing/invalid token | `{"message": "Missing authorization token"}` |
| `500` | Server error | `{"message": "Internal server error", "error": "..."}` |

**Note**: Unlike the create endpoint, this endpoint does NOT return a 404 if the post doesn't exist. It simply returns an empty array. This is intentional to simplify client-side logic.

---

### Delete Comment

Delete a comment. Only the comment author can delete their own comments.

**Endpoint**: `DELETE /posts/{postId}/comments/{commentId}`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postId` | string (UUID) | Yes | The ID of the post containing the comment |
| `commentId` | string (UUID) | Yes | The ID of the comment to delete |

**Example Request**:
```bash
curl -X DELETE https://your-api-url.com/prod/posts/a1b2c3d4-e5f6-7890-abcd-ef1234567890/comments/c7d8e9f0-1234-5678-90ab-cdef12345678 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (`200 OK`):
```json
{
  "message": "Comment deleted successfully"
}
```

**Error Responses**:

| Status Code | Scenario | Response Body |
|-------------|----------|---------------|
| `400` | Missing parameters | `{"message": "Missing post ID or comment ID"}` |
| `400` | Comment doesn't belong to post | `{"message": "Comment does not belong to the specified post"}` |
| `401` | Missing/invalid token | `{"message": "Missing authorization token"}` |
| `403` | Not comment author | `{"message": "You are not authorized to delete this comment"}` |
| `404` | Comment not found | `{"message": "Comment not found"}` |
| `500` | Server error | `{"message": "Internal server error", "error": "..."}` |

**Authorization Rules**:
- You can only delete comments that you authored
- The `userId` in the comment must match your authenticated user ID
- Attempting to delete another user's comment returns `403 Forbidden`

**What Happens Behind the Scenes**:
1. The API fetches the comment to verify it exists
2. It checks that the comment belongs to the specified post
3. It verifies you are the comment author (ownership check)
4. It deletes the comment from the database
5. It decrements the post's `commentsCount` field (if > 0)

---

## Data Models

### Comment Object

```typescript
{
  id: string;          // UUID v4, auto-generated
  postId: string;      // UUID of the parent post
  userId: string;      // UUID of the comment author
  username: string;    // Username of the comment author
  content: string;     // Comment text (1-280 characters)
  createdAt: string;   // ISO 8601 timestamp
}
```

**Field Details**:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string (UUID) | Unique identifier for the comment | `"c7d8e9f0-1234-5678-90ab-cdef12345678"` |
| `postId` | string (UUID) | ID of the post this comment belongs to | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `userId` | string (UUID) | ID of the user who created the comment | `"u9876543-21fe-dcba-0987-654321fedcba"` |
| `username` | string | Username of the comment author (for display) | `"johndoe"` |
| `content` | string | The comment text content | `"Great post!"` |
| `createdAt` | string (ISO 8601) | When the comment was created | `"2024-01-15T10:30:45.123Z"` |

**Notes**:
- `id` is automatically generated using UUID v4
- `userId` and `username` are extracted from your JWT token
- `createdAt` is set to the current server time
- `content` is sanitized (trimmed, null bytes removed)

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "message": "Human-readable error description",
  "error": "Technical details (only in 500 errors)"
}
```

### Common Error Scenarios

#### 1. Authentication Errors (401)

**Scenario**: Missing or invalid token

```bash
# Missing token
curl -X POST https://your-api-url.com/prod/posts/{postId}/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "Test"}'
```

**Response**:
```json
{
  "message": "Missing authorization token"
}
```

**Solution**: Include the `Authorization: Bearer <token>` header

---

#### 2. Validation Errors (400)

**Scenario**: Empty comment content

```bash
curl -X POST https://your-api-url.com/prod/posts/{postId}/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": ""}'
```

**Response**:
```json
{
  "message": "Comment content cannot be empty"
}
```

**Solution**: Provide content between 1-280 characters

---

**Scenario**: Content exceeds 280 characters

```bash
curl -X POST https://your-api-url.com/prod/posts/{postId}/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "This is a very long comment that exceeds the 280 character limit... [281+ characters]"}'
```

**Response**:
```json
{
  "message": "Comment content cannot exceed 280 characters"
}
```

**Solution**: Trim content to 280 characters or less

---

#### 3. Authorization Errors (403)

**Scenario**: Attempting to delete another user's comment

```bash
curl -X DELETE https://your-api-url.com/prod/posts/{postId}/comments/{commentId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "message": "You are not authorized to delete this comment"
}
```

**Solution**: You can only delete your own comments

---

#### 4. Not Found Errors (404)

**Scenario**: Post doesn't exist

```bash
curl -X POST https://your-api-url.com/prod/posts/nonexistent-id/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test"}'
```

**Response**:
```json
{
  "message": "Post not found"
}
```

**Solution**: Verify the post ID exists before commenting

---

### Error Handling Best Practices

**Client-Side Error Handling**:

```typescript
try {
  const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (response.status) {
      case 400:
        // Validation error - show to user
        alert(error.message);
        break;
      case 401:
        // Token expired - redirect to login
        window.location.href = '/login';
        break;
      case 403:
        // Not authorized - show error
        alert('You cannot delete this comment');
        break;
      case 404:
        // Resource not found
        alert('Post or comment not found');
        break;
      case 500:
        // Server error - retry or show generic message
        alert('Something went wrong. Please try again.');
        break;
    }
    
    throw new Error(error.message);
  }

  const data = await response.json();
  return data;
} catch (err) {
  console.error('API error:', err);
  throw err;
}
```

---

## Business Rules

### Character Limit

Comments are limited to **280 characters** to maintain brevity and encourage concise communication.

**Validation**:
- Minimum: 1 character (after trimming whitespace)
- Maximum: 280 characters
- Whitespace is trimmed before validation
- Null bytes (`\0`) are removed during sanitization

**Example**:
```javascript
// Valid
"Great post!" // 11 characters ✓

// Invalid - empty after trimming
"   " // 0 characters after trim ✗

// Invalid - too long
"A".repeat(281) // 281 characters ✗
```

---

### Ownership Rules

**Creating Comments**:
- Any authenticated user can comment on any post
- The comment is automatically attributed to the authenticated user
- You cannot create comments on behalf of other users

**Deleting Comments**:
- Only the comment author can delete their own comments
- Post authors cannot delete comments on their posts (unless they authored the comment)
- Admins/moderators are not currently supported

**Example Scenario**:
```
User A creates Post 1
User B comments on Post 1 → Comment 1 (author: User B)
User C comments on Post 1 → Comment 2 (author: User C)

User A CANNOT delete Comment 1 or Comment 2 (not the author)
User B CAN delete Comment 1 (is the author)
User C CAN delete Comment 2 (is the author)
```

---

### Comment Lifecycle

1. **Creation**:
   - User submits comment content
   - API validates content (1-280 chars)
   - API verifies post exists
   - Comment is created with unique ID
   - Post's `commentsCount` is incremented atomically
   - Comment is returned to client

2. **Retrieval**:
   - Comments are fetched via the post ID
   - Results are sorted by creation time (oldest first)
   - All comments include author username for display

3. **Deletion**:
   - User requests deletion
   - API verifies comment exists
   - API checks ownership (user must be author)
   - Comment is deleted
   - Post's `commentsCount` is decremented (if > 0)
   - Success message is returned

---

### Post Comment Counter

The `commentsCount` field on posts is automatically maintained:

**Incremented when**:
- A comment is successfully created
- Uses atomic DynamoDB `ADD` operation

**Decremented when**:
- A comment is successfully deleted
- Only decrements if count > 0 (prevents negative counts)

**Consistency**:
- The counter is updated atomically with comment creation/deletion
- If comment creation fails, the counter increment is rolled back
- If the counter is already 0, deletion doesn't decrement further

---

## Best Practices

### 1. Validate Input Client-Side

Validate comment content before sending to the API to provide immediate feedback:

```typescript
function validateComment(content: string): string | null {
  const trimmed = content.trim();
  
  if (trimmed.length === 0) {
    return "Comment cannot be empty";
  }
  
  if (trimmed.length > 280) {
    return `Comment is too long (${trimmed.length}/280 characters)`;
  }
  
  return null; // Valid
}

// Usage
const error = validateComment(userInput);
if (error) {
  alert(error);
  return;
}

// Proceed with API call
await createComment(postId, userInput, token);
```

---

### 2. Handle Token Expiration

Cognito tokens expire after a certain period. Implement token refresh or redirect to login:

```typescript
async function apiCall(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    // Token expired - redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  
  return response;
}
```

---

### 3. Show Character Count

Display a live character counter to help users stay within the limit:

```typescript
function CommentInput() {
  const [content, setContent] = useState('');
  const remaining = 280 - content.length;
  const isValid = content.trim().length > 0 && remaining >= 0;
  
  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={280}
        placeholder="Write a comment..."
      />
      <div style={{ color: remaining < 20 ? 'red' : 'gray' }}>
        {remaining} characters remaining
      </div>
      <button disabled={!isValid}>Post Comment</button>
    </div>
  );
}
```

---

### 4. Optimistic UI Updates

Update the UI immediately, then sync with the server:

```typescript
async function handleCreateComment(postId: string, content: string) {
  // Create optimistic comment
  const optimisticComment = {
    id: 'temp-' + Date.now(),
    postId,
    userId: currentUser.id,
    username: currentUser.username,
    content,
    createdAt: new Date().toISOString(),
  };
  
  // Add to UI immediately
  setComments([...comments, optimisticComment]);
  
  try {
    // Send to server
    const { comment } = await createComment(postId, content, token);
    
    // Replace optimistic comment with real one
    setComments(comments.map(c => 
      c.id === optimisticComment.id ? comment : c
    ));
  } catch (error) {
    // Remove optimistic comment on error
    setComments(comments.filter(c => c.id !== optimisticComment.id));
    alert('Failed to post comment: ' + error.message);
  }
}
```

---

### 5. Implement Delete Confirmation

Always confirm before deleting to prevent accidental deletions:

```typescript
async function handleDeleteComment(postId: string, commentId: string) {
  const confirmed = window.confirm(
    'Are you sure you want to delete this comment? This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  try {
    await deleteComment(postId, commentId, token);
    
    // Remove from UI
    setComments(comments.filter(c => c.id !== commentId));
  } catch (error) {
    alert('Failed to delete comment: ' + error.message);
  }
}
```

---

### 6. Show Only Delete Button for Own Comments

Only show the delete button for comments the user authored:

```typescript
function CommentItem({ comment, currentUserId }: Props) {
  const isAuthor = comment.userId === currentUserId;
  
  return (
    <div className="comment">
      <div className="comment-header">
        <strong>{comment.username}</strong>
        <span>{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <p>{comment.content}</p>
      {isAuthor && (
        <button onClick={() => handleDelete(comment.id)}>
          Delete
        </button>
      )}
    </div>
  );
}
```

---

### 7. Handle Empty States

Provide helpful messages when there are no comments:

```typescript
function CommentList({ comments }: Props) {
  if (comments.length === 0) {
    return (
      <div className="empty-state">
        <p>No comments yet. Be the first to comment!</p>
      </div>
    );
  }
  
  return (
    <div className="comments">
      {comments.map(comment => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
```

---

### 8. Implement Rate Limiting Client-Side

Prevent spam by limiting how frequently users can comment:

```typescript
let lastCommentTime = 0;
const COMMENT_COOLDOWN = 2000; // 2 seconds

async function handleCreateComment(postId: string, content: string) {
  const now = Date.now();
  const timeSinceLastComment = now - lastCommentTime;
  
  if (timeSinceLastComment < COMMENT_COOLDOWN) {
    const remaining = Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000);
    alert(`Please wait ${remaining} seconds before commenting again`);
    return;
  }
  
  lastCommentTime = now;
  
  // Proceed with comment creation
  await createComment(postId, content, token);
}
```

---

### 9. Sort Comments Appropriately

The API returns comments in ascending order (oldest first). Consider sorting options:

```typescript
function CommentList({ comments }: Props) {
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  
  const sortedComments = [...comments].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
  });
  
  return (
    <div>
      <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
        <option value="oldest">Oldest First</option>
        <option value="newest">Newest First</option>
      </select>
      {sortedComments.map(comment => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
```

---

### 10. Sanitize Display Content

While the API sanitizes input, always escape HTML when displaying user content:

```typescript
function CommentItem({ comment }: Props) {
  return (
    <div className="comment">
      <strong>{comment.username}</strong>
      {/* Use textContent or a library like DOMPurify */}
      <p>{comment.content}</p>
    </div>
  );
}

// In React, text content is automatically escaped
// For other frameworks, use appropriate escaping methods
```

---

## Complete Example: Comment Thread Component

Here's a complete React component that implements all best practices:

```typescript
import { useState, useEffect } from 'react';
import { commentsApi } from '../services/api';
import { Comment } from '../types/comment';

interface CommentThreadProps {
  postId: string;
  currentUserId: string;
  token: string;
}

export function CommentThread({ postId, currentUserId, token }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load comments on mount
  useEffect(() => {
    loadComments();
  }, [postId]);

  async function loadComments() {
    try {
      setLoading(true);
      const { comments } = await commentsApi.getComments(postId, token);
      setComments(comments);
    } catch (err) {
      setError('Failed to load comments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > 280) {
      setError('Comment must be between 1 and 280 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { comment } = await commentsApi.createComment(postId, trimmed, token);
      
      setComments([...comments, comment]);
      setContent('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;

    try {
      setLoading(true);
      await commentsApi.deleteComment(postId, commentId, token);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
    } finally {
      setLoading(false);
    }
  }

  const remaining = 280 - content.length;
  const isValid = content.trim().length > 0 && remaining >= 0;

  return (
    <div className="comment-thread">
      <h3>Comments ({comments.length})</h3>

      {error && <div className="error">{error}</div>}

      {/* Comment form */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          maxLength={280}
          disabled={loading}
        />
        <div className="comment-footer">
          <span style={{ color: remaining < 20 ? 'red' : 'gray' }}>
            {remaining} characters remaining
          </span>
          <button type="submit" disabled={!isValid || loading}>
            {loading ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments list */}
      {loading && comments.length === 0 ? (
        <div>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="empty-state">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="comments-list">
          {comments.map(comment => (
            <div key={comment.id} className="comment">
              <div className="comment-header">
                <strong>{comment.username}</strong>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p>{comment.content}</p>
              {comment.userId === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={loading}
                  className="delete-btn"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Additional Resources

- **OpenAPI Specification**: See `openapi-comments.yaml` for the complete API specification
- **Source Code**: Lambda handlers are in `backend/src/functions/comments/`
- **Architecture**: See `ARCHITECTURE.md` for system architecture details
- **Frontend Integration**: See `frontend/src/services/api.ts` for API client implementation

---

## Support

For issues or questions:
1. Check the error message and status code
2. Verify your token is valid and not expired
3. Ensure the post ID exists before commenting
4. Review the business rules and constraints
5. Check the Lambda function logs in CloudWatch for server-side errors

---

**Last Updated**: January 2024  
**API Version**: 1.0.0
