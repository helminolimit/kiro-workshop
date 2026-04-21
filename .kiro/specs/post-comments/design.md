# Design Document: Post Comments

## Overview

This feature adds a full commenting system to the Micro Blogging App. Authenticated users can create comments on posts, view all comments for a post, and delete their own comments. The feed displays a live comment count on each post card and supports an inline expandable comment thread — all without full page reloads.

The backend is implemented as three new Lambda functions (`createComment`, `getComments`, `deleteComment`) following the existing handler pattern. The frontend extends the `Feed` page with a collapsible comment thread component and wires up new API calls in `api.ts`. The existing Comments DynamoDB table (partitioned by `id`, with a `postId-index` GSI sorted by `createdAt`) is used as-is — no schema changes are needed.

---

## Architecture

The feature follows the same serverless architecture used throughout the app:

```
Browser (React SPA)
    │
    │  HTTPS / REST
    ▼
API Gateway (REST)
    │
    ├── POST   /posts/{postId}/comments   → createComment Lambda
    ├── GET    /posts/{postId}/comments   → getComments Lambda
    └── DELETE /posts/{postId}/comments/{commentId} → deleteComment Lambda
    │
    ▼
Lambda Functions (Node.js 22, CommonJS)
    │
    ├── Comments Table (DynamoDB)   — read/write
    └── Posts Table (DynamoDB)      — read (existence check) + UpdateCommand (commentsCount)
```

All three Lambda functions are protected by the existing `withAuth` middleware, which decodes the Cognito JWT and injects `event.user.id` and `event.user.username` into the event.

The `commentsCount` counter on the Posts table is updated atomically using DynamoDB `UpdateCommand` with an `ADD` expression (the same pattern used by `likePost.js` for `likesCount`).

---

## Components and Interfaces

### Backend Lambda Functions

#### `createComment` — `backend/src/functions/comments/createComment.js`

- **Method/Path**: `POST /posts/{postId}/comments`
- **Auth**: Required (`withAuth`)
- **Request body**: `{ "content": string }`
- **Logic**:
  1. Validate `content` is non-empty and ≤ 280 characters.
  2. Verify the post exists via `GetCommand` on the Posts table.
  3. Generate a UUID for the comment `id` and an ISO 8601 `createdAt` timestamp.
  4. Write the comment to the Comments table via `PutCommand`.
  5. Increment `commentsCount` on the Post item via `UpdateCommand` with `ADD commentsCount :one`.
- **Responses**:
  - `201` — `{ comment: CommentObject }`
  - `400` — missing/empty content or content > 280 chars
  - `404` — post not found
  - `500` — internal error

#### `getComments` — `backend/src/functions/comments/getComments.js`

- **Method/Path**: `GET /posts/{postId}/comments`
- **Auth**: Required (`withAuth`)
- **Logic**:
  1. Verify the post exists via `GetCommand` on the Posts table.
  2. Query the `postId-index` GSI on the Comments table with `ScanIndexForward: true` (ascending `createdAt`).
- **Responses**:
  - `200` — `{ comments: CommentObject[] }` (empty array when no comments)
  - `404` — post not found
  - `500` — internal error

#### `deleteComment` — `backend/src/functions/comments/deleteComment.js`

- **Method/Path**: `DELETE /posts/{postId}/comments/{commentId}`
- **Auth**: Required (`withAuth`)
- **Logic**:
  1. Fetch the comment via `GetCommand` on the Comments table.
  2. Return 404 if not found.
  3. Return 403 if `comment.userId !== event.user.id`.
  4. Delete the comment via `DeleteCommand`.
  5. Decrement `commentsCount` on the Post item via `UpdateCommand` with `ADD commentsCount :negOne` and a `ConditionExpression: commentsCount > :zero` to prevent going below 0. If the condition fails (count is already 0), treat as a no-op.
- **Responses**:
  - `200` — `{ message: "Comment deleted successfully" }`
  - `403` — not the author
  - `404` — comment not found
  - `500` — internal error

### Frontend Components

#### `CommentThread` — `frontend/src/components/CommentThread.tsx`

A new reusable component rendered inline within each post card when the comments toggle is active.

**Props**:
```typescript
interface CommentThreadProps {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;   // increments commentsCount in parent
  onCommentDeleted: () => void; // decrements commentsCount in parent
}
```

**Internal state**:
- `comments: Comment[]` — the loaded comment list
- `loading: boolean` — fetch in progress
- `error: string | null` — fetch error message
- `newCommentContent: string` — controlled input value
- `submitting: boolean` — create in progress

**Behaviour**:
- Fetches comments on mount via `commentsApi.getComments`.
- Appends new comment to local state on successful submit (no re-fetch).
- Removes deleted comment from local state on successful delete (no re-fetch).
- Calls `onCommentAdded` / `onCommentDeleted` callbacks to update the parent's `commentsCount`.

#### Changes to `Feed.tsx`

- Add `expandedComments: Set<string>` state to track which post cards have their thread open.
- Add `commentCounts: Record<string, number>` state to hold live comment counts (initialised from `post.commentsCount`).
- Replace the static `commentsCount` span with a clickable toggle button that shows/hides `<CommentThread>`.
- Pass `onCommentAdded` and `onCommentDeleted` callbacks that update `commentCounts` for the relevant post.

### Frontend API Service

New `commentsApi` group added to `frontend/src/services/api.ts`:

```typescript
export const commentsApi = {
  getComments: async (postId: string, token: string): Promise<{ comments: Comment[] }>,
  createComment: async (postId: string, content: string, token: string): Promise<{ comment: Comment }>,
  deleteComment: async (postId: string, commentId: string, token: string): Promise<{ message: string }>,
};
```

---

## Data Models

### Comment (DynamoDB item in Comments table)

| Attribute   | Type   | Notes                                      |
|-------------|--------|--------------------------------------------|
| `id`        | String | Partition key. UUID v4.                    |
| `postId`    | String | GSI partition key (`postId-index`).        |
| `userId`    | String | Author's user ID.                          |
| `username`  | String | Author's username (denormalised for display). |
| `content`   | String | 1–280 characters.                          |
| `createdAt` | String | ISO 8601 timestamp. GSI sort key.          |

The `postId-index` GSI already exists in the CDK stack with `postId` as partition key and `createdAt` as sort key, so no infrastructure changes are needed for the table itself.

### Comment (TypeScript interface) — `frontend/src/types/comment.ts`

```typescript
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}
```

### Post (existing, no schema change)

The `commentsCount` attribute already exists on Post items (initialised to `0` in `createPost.js`). It is updated atomically by `createComment` and `deleteComment`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Comment creation round-trip

*For any* valid comment submission (non-empty content ≤ 280 chars, valid postId, authenticated user), creating a comment and then retrieving comments for that post SHALL return a comment whose `id`, `postId`, `userId`, `username`, `content`, and `createdAt` fields all match the values stored at creation time.

**Validates: Requirements 1.1, 2.2**

---

### Property 2: commentsCount increments on create

*For any* post with any initial `commentsCount` value, successfully creating a comment on that post SHALL result in the post's `commentsCount` being exactly `initialCount + 1`.

**Validates: Requirements 1.2**

---

### Property 3: commentsCount decrements on delete (with floor of 0)

*For any* post with any `commentsCount ≥ 1`, successfully deleting one of its comments SHALL result in the post's `commentsCount` being exactly `initialCount - 1`. The `commentsCount` SHALL never be decremented below 0.

**Validates: Requirements 3.2**

---

### Property 4: Comments are returned in ascending createdAt order

*For any* set of comments on any post, the array returned by `getComments` SHALL be sorted in ascending order by `createdAt` (oldest first).

**Validates: Requirements 2.1**

---

### Property 5: Only the author can delete a comment

*For any* comment and any authenticated user who is not the comment's author, a delete request SHALL be rejected with HTTP 403.

**Validates: Requirements 3.4**

---

### Property 6: Whitespace-only content is rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), submitting it as comment content SHALL be rejected with HTTP 400 and the comment SHALL NOT be stored.

**Validates: Requirements 1.4**

---

### Property 7: Deleted comments are no longer retrievable

*For any* comment that has been successfully deleted, a subsequent call to `getComments` for the same post SHALL not include that comment in the returned array.

**Validates: Requirements 3.1**

---

### Property 8: Comment count label pluralisation

*For any* post with a `commentsCount` value that is not equal to 1, the rendered post card SHALL display the count followed by the word "Comments" (plural). When `commentsCount` is exactly 1, the rendered post card SHALL display "1 Comment" (singular).

**Validates: Requirements 4.2, 4.3**

---

### Property 9: Delete buttons appear only on the current user's comments

*For any* visible comment thread containing comments from multiple users, a delete button SHALL be rendered on every comment whose `userId` matches the currently authenticated user's ID, and SHALL NOT be rendered on any comment whose `userId` does not match.

**Validates: Requirements 5.6**

---

## Error Handling

### Backend

| Scenario | HTTP Status | Response body |
|---|---|---|
| Missing or empty `content` | 400 | `{ message: "Comment content cannot be empty" }` |
| `content` > 280 characters | 400 | `{ message: "Comment content cannot exceed 280 characters" }` |
| `postId` not found (create/get) | 404 | `{ message: "Post not found" }` |
| `commentId` not found (delete) | 404 | `{ message: "Comment not found" }` |
| Requester is not the author (delete) | 403 | `{ message: "You are not authorized to delete this comment" }` |
| Missing auth token | 401 | Handled by `withAuth` middleware |
| DynamoDB or unexpected error | 500 | `{ message: "...", error: "..." }` |

The `commentsCount` decrement uses a DynamoDB `ConditionExpression` (`commentsCount > :zero`) to prevent the counter going negative. If the condition check fails (counter is already 0), the Lambda catches the `ConditionalCheckFailedException` and treats it as a no-op rather than returning an error to the client.

### Frontend

- **Fetch failure** (getComments): `CommentThread` renders an error message in place of the comment list. The toggle remains open so the user can retry.
- **Submit failure** (createComment): An inline error message is shown below the input. The input value is preserved so the user does not lose their draft.
- **Delete failure** (deleteComment): An inline error message is shown. The comment remains visible in the thread.
- All API errors surface the `message` field from the JSON response body via the existing `handleResponse` helper in `api.ts`.

---

## Testing Strategy

### Unit / Example-Based Tests

Focus on specific scenarios and edge cases that complement the property tests:

- `createComment` returns HTTP 201 with the correct response shape.
- `getComments` returns HTTP 200 with an empty array when a post has no comments.
- `getComments` returns HTTP 404 for a non-existent post.
- `createComment` returns HTTP 404 for a non-existent post.
- `deleteComment` returns HTTP 404 for a non-existent comment.
- `deleteComment` returns HTTP 200 on successful deletion.
- `CommentThread` renders a loading indicator while fetching.
- `CommentThread` renders an error message when the fetch fails.
- `CommentThread` renders the compose input and submit button when open.
- Clicking the comments toggle opens the thread; clicking again closes it.

### Property-Based Tests

The project uses JavaScript/Node.js, so **fast-check** is the appropriate property-based testing library. Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
`// Feature: post-comments, Property N: <property text>`

**Property 1 — Comment creation round-trip**
Generate: random valid `content` (1–280 non-whitespace chars), mock `postId`, mock `userId`/`username`.
Assert: the comment returned by `getComments` contains an item matching all generated fields.

**Property 2 — commentsCount increments on create**
Generate: random initial `commentsCount` (0–1000), mock post and comment data.
Assert: after `createComment`, the post's `commentsCount` equals `initial + 1`.

**Property 3 — commentsCount decrements on delete (floor 0)**
Generate: random initial `commentsCount` (1–1000), mock post and comment data.
Assert: after `deleteComment`, the post's `commentsCount` equals `initial - 1`. Also test with `commentsCount = 0` and verify it stays at 0.

**Property 4 — Comments returned in ascending createdAt order**
Generate: random arrays of comments with shuffled ISO 8601 timestamps.
Assert: the array returned by `getComments` is sorted ascending by `createdAt`.

**Property 5 — Only the author can delete**
Generate: random comment with a random `authorId`, random `requesterId` that is not equal to `authorId`.
Assert: `deleteComment` returns HTTP 403.

**Property 6 — Whitespace-only content rejected**
Generate: strings composed entirely of whitespace characters (spaces, tabs, `\n`, `\r`).
Assert: `createComment` returns HTTP 400 and no item is written to the Comments table.

**Property 7 — Deleted comments not retrievable**
Generate: random comment data.
Assert: after `deleteComment`, `getComments` does not include the deleted comment's `id`.

**Property 8 — Comment count label pluralisation**
Generate: random integers ≠ 1 (for plural), and the fixed value 1 (for singular).
Assert: rendered output contains "Comments" for plural counts and "Comment" (singular) for count = 1.

**Property 9 — Delete buttons only on own comments**
Generate: random comment threads with mixed `userId` values, random `currentUserId`.
Assert: delete buttons are rendered exactly on comments where `userId === currentUserId`.

### Integration Considerations

The Lambda handlers interact with DynamoDB and the `withAuth` middleware. Unit tests should mock `DynamoDBDocumentClient` (using `jest.mock` or `aws-sdk-client-mock`) and inject a pre-authenticated event (bypassing `withAuth`) to test handler logic in isolation. End-to-end integration tests against a deployed stack are out of scope for this feature's test suite.
