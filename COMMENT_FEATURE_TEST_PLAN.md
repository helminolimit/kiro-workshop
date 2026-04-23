# Comment Feature Test Plan

## Overview
This document provides a comprehensive test plan for the commenting feature in the Micro Blogging App. The commenting system allows authenticated users to add comments to posts, view comments, and delete their own comments.

## System Under Test

### Backend Components
- **createComment.js**: Lambda handler for creating comments on posts
- **getComments.js**: Lambda handler for retrieving comments for a post
- **deleteComment.js**: Lambda handler for deleting comments
- **middleware.js**: Authentication middleware using Cognito JWT tokens

### Frontend Components
- **CommentThread.tsx**: React component for displaying and managing comments
- **api.ts**: API service layer with `commentsApi` methods

### Data Model
```typescript
interface Comment {
  id: string;           // UUID
  postId: string;       // Foreign key to post
  userId: string;       // Foreign key to user
  username: string;     // Denormalized for display
  content: string;      // Max 280 characters
  createdAt: string;    // ISO 8601 timestamp
}
```

---

## 1. Unit Tests - Backend Lambda Handlers

### Test Framework
**Jest** with AWS SDK mocking

### Mock Strategy
- Mock `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` using Jest mocks
- Mock `@aws-sdk/client-cognito-identity-provider` for auth middleware
- Use `jest.fn()` for DynamoDB command responses
- Set environment variables in `beforeEach`: `POSTS_TABLE`, `COMMENTS_TABLE`, `USERS_TABLE`

---

### 1.1 createComment.js Tests

#### Test: Successfully create a comment
**Description**: Verify that a valid comment is created and stored in DynamoDB

**Preconditions**:
- User is authenticated (event.user populated by middleware)
- Post exists in database
- Valid comment content provided

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  body: JSON.stringify({ content: 'Great post!' }),
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 201
- Response body contains comment object with:
  - Generated UUID `id`
  - `postId: 'post-123'`
  - `userId: 'user-456'`
  - `username: 'testuser'`
  - `content: 'Great post!'`
  - `createdAt` as ISO timestamp
- DynamoDB PutCommand called with comment item
- DynamoDB UpdateCommand called to increment post's `commentsCount`

**Mocks**:
- `GetCommand` returns post item
- `PutCommand` succeeds
- `UpdateCommand` succeeds

---

#### Test: Reject empty comment content
**Description**: Validate that empty or whitespace-only content is rejected

**Preconditions**: User authenticated

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  body: JSON.stringify({ content: '   ' }),
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Comment content cannot be empty' }`
- No DynamoDB operations performed

---

#### Test: Reject comment exceeding 280 characters
**Description**: Validate character limit enforcement

**Preconditions**: User authenticated

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  body: JSON.stringify({ content: 'a'.repeat(281) }),
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Comment content cannot exceed 280 characters' }`

---

#### Test: Reject comment on non-existent post
**Description**: Verify post existence check

**Preconditions**: User authenticated

**Input**:
```javascript
{
  pathParameters: { postId: 'nonexistent-post' },
  body: JSON.stringify({ content: 'Comment' }),
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 404
- Response body: `{ message: 'Post not found' }`

**Mocks**:
- `GetCommand` returns empty result (no Item)

---

#### Test: Handle missing postId parameter
**Description**: Validate required path parameter

**Input**:
```javascript
{
  pathParameters: {},
  body: JSON.stringify({ content: 'Comment' }),
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Missing post ID' }`

---

#### Test: Handle missing request body
**Description**: Validate request body presence

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  body: null,
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Comment content cannot be empty' }`

---

#### Test: Handle DynamoDB errors gracefully
**Description**: Verify error handling for database failures

**Preconditions**: User authenticated, post exists

**Input**: Valid comment creation request

**Expected Output**:
- Status code: 500
- Response body contains error message

**Mocks**:
- `PutCommand` throws error

---

### 1.2 getComments.js Tests

#### Test: Successfully retrieve comments for a post
**Description**: Verify comments are fetched and returned correctly

**Preconditions**:
- User authenticated
- Post exists with multiple comments

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 200
- Response body: `{ comments: [...] }` with array of comment objects
- Comments sorted by `createdAt` ascending

**Mocks**:
- `GetCommand` returns post item
- `QueryCommand` returns array of comments using `postId-index` GSI

---

#### Test: Return empty array for post with no comments
**Description**: Handle posts without comments

**Preconditions**: User authenticated, post exists

**Input**: Valid request for post with no comments

**Expected Output**:
- Status code: 200
- Response body: `{ comments: [] }`

**Mocks**:
- `GetCommand` returns post item
- `QueryCommand` returns empty Items array

---

#### Test: Reject request for non-existent post
**Description**: Validate post existence

**Input**:
```javascript
{
  pathParameters: { postId: 'nonexistent-post' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 404
- Response body: `{ message: 'Post not found' }`

**Mocks**:
- `GetCommand` returns empty result

---

#### Test: Handle missing postId parameter
**Description**: Validate required parameter

**Input**:
```javascript
{
  pathParameters: {},
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Missing post ID' }`

---

#### Test: Handle DynamoDB query errors
**Description**: Verify error handling for query failures

**Preconditions**: User authenticated, post exists

**Input**: Valid request

**Expected Output**:
- Status code: 500
- Response body contains error message

**Mocks**:
- `QueryCommand` throws error

---

### 1.3 deleteComment.js Tests

#### Test: Successfully delete own comment
**Description**: Verify comment owner can delete their comment

**Preconditions**:
- User authenticated
- Comment exists and belongs to user

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123', commentId: 'comment-789' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 200
- Response body: `{ message: 'Comment deleted successfully' }`
- DynamoDB DeleteCommand called
- DynamoDB UpdateCommand called to decrement post's `commentsCount`

**Mocks**:
- `GetCommand` returns comment with `userId: 'user-456'`
- `DeleteCommand` succeeds
- `UpdateCommand` succeeds

---

#### Test: Reject deletion of non-existent comment
**Description**: Validate comment existence

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123', commentId: 'nonexistent' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 404
- Response body: `{ message: 'Comment not found' }`

**Mocks**:
- `GetCommand` returns empty result

---

#### Test: Reject deletion of another user's comment
**Description**: Verify authorization check

**Preconditions**: Comment exists but belongs to different user

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123', commentId: 'comment-789' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 403
- Response body: `{ message: 'You are not authorized to delete this comment' }`
- No delete operation performed

**Mocks**:
- `GetCommand` returns comment with `userId: 'different-user'`

---

#### Test: Handle missing path parameters
**Description**: Validate required parameters

**Input**:
```javascript
{
  pathParameters: { postId: 'post-123' },
  user: { id: 'user-456', username: 'testuser' }
}
```

**Expected Output**:
- Status code: 400
- Response body: `{ message: 'Missing post ID or comment ID' }`

---

#### Test: Handle commentsCount decrement when already zero
**Description**: Verify conditional update handling

**Preconditions**: Comment exists, post's commentsCount is 0

**Input**: Valid delete request

**Expected Output**:
- Status code: 200
- Comment deleted successfully
- ConditionalCheckFailedException caught and logged

**Mocks**:
- `GetCommand` returns comment
- `DeleteCommand` succeeds
- `UpdateCommand` throws `ConditionalCheckFailedException`

---

#### Test: Handle DynamoDB errors during deletion
**Description**: Verify error handling

**Preconditions**: Comment exists and belongs to user

**Input**: Valid delete request

**Expected Output**:
- Status code: 500
- Response body contains error message

**Mocks**:
- `DeleteCommand` throws error

---

### 1.4 middleware.js (withAuth) Tests

#### Test: Successfully authenticate with valid JWT token
**Description**: Verify token decoding and user lookup

**Input**:
```javascript
{
  headers: { Authorization: 'Bearer <valid-jwt>' },
  pathParameters: {},
  body: null
}
```

**Expected Output**:
- Handler receives event with `user: { id: 'user-id', username: 'username' }`
- No 401 response

**Mocks**:
- JWT payload contains `cognito:username`
- DynamoDB QueryCommand returns user from `username-index`

---

#### Test: Reject request with missing Authorization header
**Description**: Validate auth header presence

**Input**:
```javascript
{
  headers: {},
  pathParameters: {},
  body: null
}
```

**Expected Output**:
- Status code: 401
- Response body: `{ message: 'Missing authorization token' }`
- Handler not called

---

#### Test: Reject request with invalid JWT token
**Description**: Handle malformed tokens

**Input**:
```javascript
{
  headers: { Authorization: 'Bearer invalid-token' },
  pathParameters: {},
  body: null
}
```

**Expected Output**:
- Status code: 401
- Response body: `{ message: 'Authentication failed', error: '...' }`

**Mocks**:
- Token decoding fails
- Cognito GetUserCommand throws error

---

#### Test: Handle user not found in database
**Description**: Verify user existence check

**Input**: Valid JWT token

**Expected Output**:
- Status code: 401
- Response body contains error

**Mocks**:
- JWT decodes successfully
- DynamoDB QueryCommand returns empty result

---

---

## 2. Unit Tests - Frontend Components

### Test Framework
**Jest** with React Testing Library

### Mock Strategy
- Mock `commentsApi` methods from `services/api.ts`
- Mock `useAuth` hook to provide test token
- Use `@testing-library/react` for component rendering
- Use `@testing-library/user-event` for user interactions

---

### 2.1 CommentThread.tsx Tests

#### Test: Render loading state initially
**Description**: Verify loading indicator displays while fetching

**Preconditions**: Component mounted

**Setup**:
```typescript
const mockGetComments = jest.fn(() => new Promise(() => {})); // Never resolves
commentsApi.getComments = mockGetComments;
```

**Expected Output**:
- Loading spinner visible
- No comments displayed
- Comment form visible

---

#### Test: Display comments after successful fetch
**Description**: Verify comments render correctly

**Preconditions**: API returns comments

**Setup**:
```typescript
const mockComments = [
  { id: '1', postId: 'post-1', userId: 'user-1', username: 'alice', content: 'First!', createdAt: '2024-01-01T10:00:00Z' },
  { id: '2', postId: 'post-1', userId: 'user-2', username: 'bob', content: 'Nice post', createdAt: '2024-01-01T11:00:00Z' }
];
commentsApi.getComments = jest.fn().mockResolvedValue({ comments: mockComments });
```

**Expected Output**:
- Two comment items rendered
- Each shows username, content, and formatted date
- Delete button only visible on current user's comments

---

#### Test: Display error message on fetch failure
**Description**: Handle API errors gracefully

**Setup**:
```typescript
commentsApi.getComments = jest.fn().mockRejectedValue(new Error('Network error'));
```

**Expected Output**:
- Error message displayed: "Network error"
- No comments shown
- Comment form still visible

---

#### Test: Submit new comment successfully
**Description**: Verify comment creation flow

**Preconditions**: Comments loaded

**User Actions**:
1. Type "Great post!" in comment input
2. Click "Post" button

**Setup**:
```typescript
const newComment = { id: '3', postId: 'post-1', userId: 'user-1', username: 'testuser', content: 'Great post!', createdAt: '2024-01-01T12:00:00Z' };
commentsApi.createComment = jest.fn().mockResolvedValue({ comment: newComment });
```

**Expected Output**:
- `createComment` called with correct parameters
- New comment appears in list
- Input field cleared
- `onCommentAdded` callback invoked
- Submit button shows "Posting..." during submission

---

#### Test: Prevent submission of empty comment
**Description**: Validate client-side input

**User Actions**:
1. Leave input empty
2. Click "Post" button

**Expected Output**:
- No API call made
- Form not submitted
- Input remains empty

---

#### Test: Display error on comment submission failure
**Description**: Handle creation errors

**Setup**:
```typescript
commentsApi.createComment = jest.fn().mockRejectedValue(new Error('Failed to post comment'));
```

**User Actions**:
1. Type comment
2. Click "Post"

**Expected Output**:
- Error message displayed below form
- Comment not added to list
- Input retains typed content

---

#### Test: Delete own comment successfully
**Description**: Verify deletion flow

**Preconditions**: User's comment displayed

**Setup**:
```typescript
const mockComments = [
  { id: '1', postId: 'post-1', userId: 'current-user', username: 'testuser', content: 'My comment', createdAt: '2024-01-01T10:00:00Z' }
];
commentsApi.deleteComment = jest.fn().mockResolvedValue({ message: 'Comment deleted successfully' });
```

**User Actions**:
1. Click "Delete" button on own comment

**Expected Output**:
- `deleteComment` called with correct IDs
- Comment removed from list
- `onCommentDeleted` callback invoked

---

#### Test: Display error on deletion failure
**Description**: Handle deletion errors

**Setup**:
```typescript
commentsApi.deleteComment = jest.fn().mockRejectedValue(new Error('Failed to delete comment'));
```

**User Actions**:
1. Click "Delete" button

**Expected Output**:
- Error message displayed
- Comment remains in list

---

#### Test: Hide delete button on other users' comments
**Description**: Verify authorization UI

**Setup**:
```typescript
const mockComments = [
  { id: '1', postId: 'post-1', userId: 'other-user', username: 'alice', content: 'Comment', createdAt: '2024-01-01T10:00:00Z' }
];
```

**Props**:
```typescript
currentUserId="current-user"
```

**Expected Output**:
- Comment displayed
- No delete button visible

---

#### Test: Disable form during submission
**Description**: Prevent duplicate submissions

**Setup**:
```typescript
commentsApi.createComment = jest.fn(() => new Promise(() => {})); // Never resolves
```

**User Actions**:
1. Type comment
2. Click "Post"

**Expected Output**:
- Input field disabled
- Submit button disabled
- Button text shows "Posting..."

---

#### Test: Refetch comments when postId changes
**Description**: Verify useEffect dependency

**Setup**: Render with `postId="post-1"`, then update to `postId="post-2"`

**Expected Output**:
- `getComments` called twice (once for each postId)
- Comments updated to match new post

---

---

## 3. Integration Tests

### Test Framework
**Playwright** for end-to-end testing

### Test Environment
- Frontend running on Vite dev server
- Backend deployed to AWS (or local mock)
- Test user accounts pre-created in Cognito

---

### 3.1 End-to-End Comment Creation Flow

#### Test: Create comment on post
**Description**: Full flow from login to comment creation

**Preconditions**:
- Test user exists: `testuser@example.com` / `TestPass123!`
- Test post exists with known ID

**Steps**:
1. Navigate to login page
2. Enter credentials and submit
3. Navigate to feed
4. Click on post to view details (or expand comments)
5. Type "This is a test comment" in comment input
6. Click "Post" button
7. Wait for comment to appear

**Expected Results**:
- Comment appears in thread
- Shows correct username and content
- Timestamp is recent
- Post's comment count incremented (if visible)

**Playwright Code**:
```typescript
test('create comment on post', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'testuser@example.com');
  await page.fill('input[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('/feed');
  
  // Assuming comments are visible on feed
  const commentInput = page.locator('.comment-input').first();
  await commentInput.fill('This is a test comment');
  await page.click('.comment-submit-button');
  
  await expect(page.locator('.comment-content').filter({ hasText: 'This is a test comment' })).toBeVisible();
});
```

---

### 3.2 Comment Retrieval and Display

#### Test: View comments on post
**Description**: Verify comments load and display correctly

**Preconditions**:
- User logged in
- Post has existing comments

**Steps**:
1. Navigate to feed
2. Locate post with comments
3. Verify comments are displayed

**Expected Results**:
- All comments visible
- Sorted by creation time (oldest first)
- Each shows username, content, timestamp
- Delete button only on own comments

---

### 3.3 Comment Deletion Flow

#### Test: Delete own comment
**Description**: Full deletion flow

**Preconditions**:
- User logged in
- User has created a comment

**Steps**:
1. Navigate to post with own comment
2. Click "Delete" button on comment
3. Wait for comment to disappear

**Expected Results**:
- Comment removed from UI
- Post's comment count decremented
- No error messages

**Playwright Code**:
```typescript
test('delete own comment', async ({ page }) => {
  // Assume logged in and comment exists
  const commentText = 'Comment to delete';
  const commentItem = page.locator('.comment-item').filter({ hasText: commentText });
  
  await commentItem.locator('.comment-delete-button').click();
  
  await expect(commentItem).not.toBeVisible();
});
```

---

### 3.4 Authentication Integration

#### Test: Reject unauthenticated comment creation
**Description**: Verify auth requirement

**Preconditions**: User not logged in

**Steps**:
1. Navigate directly to feed URL (bypassing login)
2. Attempt to view comments

**Expected Results**:
- Redirected to login page OR
- Comments not loaded, auth error shown

---

#### Test: Token expiration handling
**Description**: Verify behavior when token expires

**Preconditions**:
- User logged in with short-lived token
- Wait for token expiration

**Steps**:
1. Wait for token to expire
2. Attempt to create comment

**Expected Results**:
- 401 error handled gracefully
- User prompted to re-authenticate OR
- Automatic token refresh (if implemented)

---

---

## 4. Edge Cases & Error Scenarios

### 4.1 Invalid Inputs

#### Test: Submit comment with only whitespace
**Description**: Backend validation of whitespace-only content

**Test Type**: Backend unit test + E2E

**Input**: `{ content: '    \n\t  ' }`

**Expected**: 400 error, "Comment content cannot be empty"

---

#### Test: Submit comment with exactly 280 characters
**Description**: Boundary condition - valid

**Input**: `{ content: 'a'.repeat(280) }`

**Expected**: 201 success, comment created

---

#### Test: Submit comment with 281 characters
**Description**: Boundary condition - invalid

**Input**: `{ content: 'a'.repeat(281) }`

**Expected**: 400 error, "Comment content cannot exceed 280 characters"

---

#### Test: Submit comment with special characters
**Description**: Verify special character handling

**Input**: `{ content: '<script>alert("XSS")</script>' }`

**Expected**:
- 201 success, comment created
- Content stored as-is (no sanitization in backend)
- Frontend displays safely (React escapes by default)

---

#### Test: Submit comment with Unicode/emoji
**Description**: Verify Unicode support

**Input**: `{ content: 'Great post! 🎉👍' }`

**Expected**: 201 success, emoji preserved

---

#### Test: Submit comment with newlines
**Description**: Verify multiline content handling

**Input**: `{ content: 'Line 1\nLine 2\nLine 3' }`

**Expected**: 201 success, newlines preserved

---

### 4.2 Authorization Failures

#### Test: Comment on deleted post
**Description**: Handle post deletion race condition

**Scenario**:
1. User loads post with comments
2. Post is deleted by author
3. User attempts to add comment

**Expected**: 404 error, "Post not found"

---

#### Test: Delete comment after it's already deleted
**Description**: Handle deletion race condition

**Scenario**:
1. Two tabs open with same comment
2. Delete in tab 1
3. Attempt delete in tab 2

**Expected**: 404 error, "Comment not found"

---

#### Test: Attempt to delete another user's comment via API
**Description**: Verify authorization bypass prevention

**Test Type**: Backend unit test

**Setup**: Mock authenticated user A, comment belongs to user B

**Expected**: 403 error, "You are not authorized to delete this comment"

---

### 4.3 Network Failures and Timeouts

#### Test: Comment creation with network timeout
**Description**: Handle slow/failed requests

**Test Type**: Frontend unit test

**Setup**: Mock API call that times out

**Expected**:
- Error message displayed
- Comment not added to UI
- User can retry

---

#### Test: Comment fetch with network failure
**Description**: Handle failed initial load

**Test Type**: Frontend unit test

**Setup**: Mock API call rejection

**Expected**:
- Error message displayed
- Retry mechanism available (manual refresh)

---

#### Test: Partial comment list load
**Description**: Handle incomplete data

**Test Type**: Frontend unit test

**Setup**: Mock API returns malformed data

**Expected**:
- Error handled gracefully
- No crash, error message shown

---

### 4.4 Concurrent Operations

#### Test: Multiple users commenting simultaneously
**Description**: Verify no data corruption

**Test Type**: Integration test

**Scenario**:
1. Two users comment on same post at same time
2. Both comments should be created
3. commentsCount should increment by 2

**Expected**: Both comments visible, correct count

---

#### Test: Comment while post is being deleted
**Description**: Race condition handling

**Scenario**:
1. User A starts creating comment
2. User B (post author) deletes post
3. User A's comment request completes

**Expected**: 404 error, comment not created

---

#### Test: Delete comment while another user is viewing
**Description**: Verify eventual consistency

**Scenario**:
1. User A views comments
2. User B deletes their comment
3. User A refreshes

**Expected**: Deleted comment no longer visible

---

### 4.5 Boundary Conditions

#### Test: Post with zero comments
**Description**: Handle empty state

**Expected**: Empty array returned, no errors

---

#### Test: Post with 1000+ comments
**Description**: Performance with large dataset

**Test Type**: Performance test

**Setup**: Create post with 1000 comments

**Expected**:
- All comments retrieved (or paginated if implemented)
- Reasonable load time (<3 seconds)
- UI remains responsive

---

#### Test: User with no username
**Description**: Handle missing denormalized data

**Test Type**: Backend unit test

**Setup**: Mock user with empty username

**Expected**: Comment created with empty username (or validation error)

---

#### Test: Comment with null/undefined fields
**Description**: Verify data integrity

**Test Type**: Backend unit test

**Input**: Request with missing fields

**Expected**: 400 error or default values applied

---

---

## 5. Performance Tests

### Test Framework
**Artillery** or **k6** for load testing

---

### 5.1 Large Number of Comments

#### Test: Load post with 500 comments
**Description**: Measure query performance

**Setup**:
- Create post with 500 comments
- Measure getComments response time

**Metrics**:
- Response time < 1 second (p95)
- DynamoDB read capacity within limits

**Expected**: Acceptable performance, consider pagination if slow

---

#### Test: Create 100 comments in 10 seconds
**Description**: Measure write throughput

**Setup**: Concurrent comment creation requests

**Metrics**:
- All requests succeed
- commentsCount accurate
- No throttling errors

---

### 5.2 Pagination Scenarios

#### Test: Fetch comments with pagination (if implemented)
**Description**: Verify pagination logic

**Note**: Current implementation does not include pagination. This test is for future enhancement.

**Setup**: Post with 200 comments

**Steps**:
1. Fetch first page (limit 50)
2. Fetch subsequent pages using nextToken

**Expected**:
- All comments retrieved across pages
- No duplicates
- Correct order maintained

---

---

## Test Execution Strategy

### Phase 1: Unit Tests
1. Backend handler tests (Jest)
2. Frontend component tests (Jest + RTL)
3. Run in CI/CD pipeline on every commit

### Phase 2: Integration Tests
1. E2E tests (Playwright)
2. Run on staging environment before production deploy
3. Include in nightly test suite

### Phase 3: Performance Tests
1. Load tests on staging
2. Run weekly or before major releases
3. Monitor CloudWatch metrics

---

## Test Data Management

### Backend Tests
- Use in-memory mocks, no real AWS resources
- Reset mocks in `beforeEach`

### Integration Tests
- Use dedicated test Cognito user pool
- Seed test data before test runs
- Clean up test data after runs

### Performance Tests
- Use separate AWS account/stage
- Pre-populate with realistic data volumes

---

## Success Criteria

### Unit Tests
- **Coverage**: >80% code coverage for handlers and components
- **Pass Rate**: 100% passing tests

### Integration Tests
- **Pass Rate**: 100% passing tests
- **Flakiness**: <5% flaky test rate

### Performance Tests
- **Response Time**: p95 < 1 second for getComments
- **Throughput**: Support 100 concurrent comment creations
- **Error Rate**: <1% error rate under load

---

## Tools and Dependencies

### Backend Testing
```json
{
  "devDependencies": {
    "jest": "^29.6.4",
    "aws-sdk-client-mock": "^3.0.0",
    "@types/jest": "^29.5.0"
  }
}
```

### Frontend Testing
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jest": "^29.6.4",
    "jest-environment-jsdom": "^29.6.4"
  }
}
```

### E2E Testing
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

### Performance Testing
- Artillery: `npm install -g artillery`
- k6: Download from k6.io

---

## Appendix: Test File Structure

```
backend/
  src/
    functions/
      comments/
        __tests__/
          createComment.test.js
          getComments.test.js
          deleteComment.test.js
    common/
      __tests__/
        middleware.test.js

frontend/
  src/
    components/
      __tests__/
        CommentThread.test.tsx
    services/
      __tests__/
        api.test.ts

e2e/
  tests/
    comments/
      create-comment.spec.ts
      view-comments.spec.ts
      delete-comment.spec.ts
      comment-auth.spec.ts

performance/
  scenarios/
    comment-load.yml
    comment-creation.yml
```

---

## Next Steps

1. **Set up Jest** for backend and frontend unit tests
2. **Implement backend handler tests** following the test cases above
3. **Implement frontend component tests** using React Testing Library
4. **Extend Playwright tests** to cover comment scenarios
5. **Set up performance testing** infrastructure
6. **Integrate tests into CI/CD** pipeline
7. **Monitor test results** and maintain >80% coverage

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Owner**: Development Team
