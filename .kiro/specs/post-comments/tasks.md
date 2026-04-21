# Implementation Plan: Post Comments

## Overview

Implement a full commenting system across three layers: three new Lambda handlers on the backend, CDK infrastructure wiring, and a React `CommentThread` component with updated `Feed.tsx` on the frontend. The existing Comments DynamoDB table and its `postId-index` GSI are used as-is — no schema changes are needed.

Tasks are ordered so each step produces working, integrated code before moving to the next. Backend handlers are built first so the frontend has real endpoints to call.

## Tasks

- [x] 1. Add fast-check as a dev dependency to the backend package
  - Run `yarn workspace backend add --dev fast-check` to install fast-check for property-based testing
  - Verify it appears in `backend/package.json` under `devDependencies`
  - _Requirements: Testing infrastructure for all property tests_

- [x] 2. Create the `createComment` Lambda handler
  - Create `backend/src/functions/comments/createComment.js` following the same CommonJS pattern as `createPost.js` and `likePost.js`
  - Parse and validate `event.body`: reject missing/empty `content` with HTTP 400; reject `content` longer than 280 characters with HTTP 400; trim and check for whitespace-only strings
  - Verify the post exists via `GetCommand` on the Posts table (env var `POSTS_TABLE`); return HTTP 404 if not found
  - Generate a UUID v4 `id` and ISO 8601 `createdAt` timestamp; write the comment item to the Comments table (env var `COMMENTS_TABLE`) via `PutCommand` with fields: `id`, `postId`, `userId` (`event.user.id`), `username` (`event.user.username`), `content`, `createdAt`
  - Increment `commentsCount` on the Post item via `UpdateCommand` with `ADD commentsCount :one`
  - Return HTTP 201 with `{ comment: CommentObject }`
  - Export `withAuth(handler)`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.1 Write unit tests for `createComment`
    - Mock `DynamoDBDocumentClient` using `aws-sdk-client-mock` or `jest.mock`; inject a pre-authenticated event (bypass `withAuth`)
    - Test: returns HTTP 201 with correct response shape on valid input
    - Test: returns HTTP 400 when `content` is absent
    - Test: returns HTTP 400 when `content` is empty string
    - Test: returns HTTP 400 when `content` exceeds 280 characters
    - Test: returns HTTP 404 when the post does not exist
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test — Property 6: Whitespace-only content rejected
    - `// Feature: post-comments, Property 6: Whitespace-only content is rejected`
    - Generate strings composed entirely of whitespace characters (spaces, tabs, `\n`, `\r`) using fast-check
    - Assert: `createComment` returns HTTP 400 and no `PutCommand` is sent to DynamoDB
    - Run minimum 100 iterations
    - _Requirements: 1.4_

  - [ ]* 2.3 Write property test — Property 1: Comment creation round-trip
    - `// Feature: post-comments, Property 1: Comment creation round-trip`
    - Generate random valid `content` (1–280 non-whitespace chars), mock `postId`, mock `userId`/`username`
    - Assert: the comment object returned in the HTTP 201 response contains `id`, `postId`, `userId`, `username`, `content`, and `createdAt` fields that all match the input values
    - Run minimum 100 iterations
    - _Requirements: 1.1, 2.2_

  - [ ]* 2.4 Write property test — Property 2: commentsCount increments on create
    - `// Feature: post-comments, Property 2: commentsCount increments on create`
    - Generate random initial `commentsCount` values (0–1000) and mock post/comment data
    - Assert: after `createComment` succeeds, the `UpdateCommand` sent to DynamoDB uses `ADD commentsCount :one` (i.e. the increment is always exactly 1 regardless of initial value)
    - Run minimum 100 iterations
    - _Requirements: 1.2_

- [x] 3. Create the `getComments` Lambda handler
  - Create `backend/src/functions/comments/getComments.js`
  - Read `postId` from `event.pathParameters.postId`
  - Verify the post exists via `GetCommand` on the Posts table; return HTTP 404 if not found
  - Query the `postId-index` GSI on the Comments table with `KeyConditionExpression: 'postId = :postId'` and `ScanIndexForward: true` to return comments in ascending `createdAt` order
  - Return HTTP 200 with `{ comments: CommentObject[] }` (empty array when no comments exist)
  - Export `withAuth(handler)`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.1 Write unit tests for `getComments`
    - Test: returns HTTP 200 with an empty array when a post has no comments
    - Test: returns HTTP 200 with the correct comment shape when comments exist
    - Test: returns HTTP 404 for a non-existent post
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 3.2 Write property test — Property 4: Comments returned in ascending createdAt order
    - `// Feature: post-comments, Property 4: Comments are returned in ascending createdAt order`
    - Generate random arrays of comment objects with shuffled ISO 8601 timestamps using fast-check
    - Assert: the array returned by `getComments` is sorted in ascending order by `createdAt` (oldest first)
    - Run minimum 100 iterations
    - _Requirements: 2.1_

  - [ ]* 3.3 Write property test — Property 7: Deleted comments not retrievable
    - `// Feature: post-comments, Property 7: Deleted comments are no longer retrievable`
    - Generate random comment data; simulate a delete followed by a get
    - Assert: after `deleteComment` succeeds, the mock DynamoDB state no longer contains the deleted comment's `id`, and a subsequent `getComments` call does not include it
    - Run minimum 100 iterations
    - _Requirements: 3.1_

- [x] 4. Create the `deleteComment` Lambda handler
  - Create `backend/src/functions/comments/deleteComment.js`
  - Read `postId` from `event.pathParameters.postId` and `commentId` from `event.pathParameters.commentId`
  - Fetch the comment via `GetCommand` on the Comments table; return HTTP 404 if not found
  - Return HTTP 403 with `{ message: "You are not authorized to delete this comment" }` if `comment.userId !== event.user.id`
  - Delete the comment via `DeleteCommand`
  - Decrement `commentsCount` on the Post item via `UpdateCommand` with `ADD commentsCount :negOne` and `ConditionExpression: 'commentsCount > :zero'`; catch `ConditionalCheckFailedException` and treat it as a no-op (do not return an error)
  - Return HTTP 200 with `{ message: "Comment deleted successfully" }`
  - Export `withAuth(handler)`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.1 Write unit tests for `deleteComment`
    - Test: returns HTTP 200 on successful deletion
    - Test: returns HTTP 404 when the comment does not exist
    - Test: returns HTTP 403 when the requester is not the author
    - Test: does not error when `commentsCount` is already 0 (ConditionalCheckFailedException is swallowed)
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write property test — Property 5: Only the author can delete
    - `// Feature: post-comments, Property 5: Only the author can delete a comment`
    - Generate random comment with a random `authorId`; generate a random `requesterId` that is guaranteed not equal to `authorId` using fast-check
    - Assert: `deleteComment` returns HTTP 403 for every such pair
    - Run minimum 100 iterations
    - _Requirements: 3.4_

  - [ ]* 4.3 Write property test — Property 3: commentsCount decrements on delete (floor 0)
    - `// Feature: post-comments, Property 3: commentsCount decrements on delete with floor of 0`
    - Generate random initial `commentsCount` values ≥ 1; assert the `UpdateCommand` uses `ADD commentsCount :negOne`
    - Also generate the case where `commentsCount = 0`; assert `ConditionalCheckFailedException` is caught and HTTP 200 is still returned
    - Run minimum 100 iterations
    - _Requirements: 3.2_

- [x] 5. Checkpoint — backend handlers complete
  - Ensure all backend unit and property tests pass, ask the user if questions arise.

- [x] 6. Wire comment Lambda functions into the CDK stack
  - In `infrastructure/lib/app-stack.ts`, add three `lambda.Function` constructs following the existing pattern:
    - `CreateCommentFunction`: handler `createComment.handler`, code from `getLambdaPackagePath('createComment')`, env vars `POSTS_TABLE`, `COMMENTS_TABLE`, `USERS_TABLE`
    - `GetCommentsFunction`: handler `getComments.handler`, code from `getLambdaPackagePath('getComments')`, env vars `POSTS_TABLE`, `COMMENTS_TABLE`, `USERS_TABLE`
    - `DeleteCommentFunction`: handler `deleteComment.handler`, code from `getLambdaPackagePath('deleteComment')`, env vars `POSTS_TABLE`, `COMMENTS_TABLE`, `USERS_TABLE`
  - Grant IAM permissions:
    - `this.commentsTable.grantReadWriteData(createCommentFunction)`
    - `this.postsTable.grantReadWriteData(createCommentFunction)` (needs UpdateCommand on Posts)
    - `this.usersTable.grantReadData(createCommentFunction)`
    - `this.commentsTable.grantReadData(getCommentsFunction)`
    - `this.postsTable.grantReadData(getCommentsFunction)`
    - `this.usersTable.grantReadData(getCommentsFunction)`
    - `this.commentsTable.grantReadWriteData(deleteCommentFunction)`
    - `this.postsTable.grantReadWriteData(deleteCommentFunction)` (needs UpdateCommand on Posts)
    - `this.usersTable.grantReadData(deleteCommentFunction)`
  - Add API Gateway resources and methods under the existing `postId` resource:
    - `const comments = postId.addResource('comments')` → `GET` → `getCommentsFunction`, `POST` → `createCommentFunction`
    - `const commentId = comments.addResource('{commentId}')` → `DELETE` → `deleteCommentFunction`
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 7. Add the `Comment` TypeScript type and `commentsApi` service to the frontend
  - Create `frontend/src/types/comment.ts` with the `Comment` interface: `id`, `postId`, `userId`, `username`, `content`, `createdAt` (all strings)
  - Add `commentsApi` to `frontend/src/services/api.ts` with three methods following the existing `postsApi` pattern:
    - `getComments(postId, token)` → `GET ${API_URL}/posts/${postId}/comments` with `Authorization` header → returns `{ comments: Comment[] }`
    - `createComment(postId, content, token)` → `POST ${API_URL}/posts/${postId}/comments` with JSON body `{ content }` → returns `{ comment: Comment }`
    - `deleteComment(postId, commentId, token)` → `DELETE ${API_URL}/posts/${postId}/comments/${commentId}` → returns `{ message: string }`
  - All three methods use the existing `handleResponse` helper
  - _Requirements: 1.3, 2.2, 3.3_

- [x] 8. Build the `CommentThread` component
  - Create `frontend/src/components/CommentThread.tsx`
  - Define props interface: `postId: string`, `currentUserId: string`, `onCommentAdded: () => void`, `onCommentDeleted: () => void`
  - Internal state: `comments: Comment[]`, `loading: boolean`, `error: string | null`, `newCommentContent: string`, `submitting: boolean`, `submitError: string | null`
  - On mount, call `commentsApi.getComments(postId, token)` and populate `comments`; show a loading indicator (`<div className="loading"><div className="spinner" /></div>`) while fetching; show an error message if the fetch fails (thread stays open for retry)
  - Render the comment list: each comment shows `username`, `createdAt` (formatted), and `content`
  - Render a delete button on each comment where `comment.userId === currentUserId`; on click call `commentsApi.deleteComment`, remove the comment from local state, call `onCommentDeleted`, show an inline error if the call fails
  - Render a compose area (text input bound to `newCommentContent` + submit button); on submit call `commentsApi.createComment`, append the returned comment to local state, clear the input, call `onCommentAdded`; show an inline error below the input if the call fails (preserve input value)
  - Use `token` from `useAuth()` context
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 8.1 Write unit tests for `CommentThread`
    - Use React Testing Library (add as dev dependency if not present: `yarn workspace frontend add --dev @testing-library/react @testing-library/jest-dom`)
    - Test: renders a loading indicator while fetching
    - Test: renders an error message when the fetch fails
    - Test: renders the compose input and submit button when comments load successfully
    - Test: renders a delete button only on comments whose `userId` matches `currentUserId`
    - _Requirements: 5.2, 5.4, 5.6, 5.8_

  - [ ]* 8.2 Write property test — Property 9: Delete buttons only on own comments
    - `// Feature: post-comments, Property 9: Delete buttons appear only on the current user's comments`
    - Generate random comment threads with mixed `userId` values and a random `currentUserId` using fast-check
    - Assert: delete buttons are rendered on exactly the comments where `userId === currentUserId`, and not on any others
    - Run minimum 100 iterations
    - _Requirements: 5.6_

- [x] 9. Update `Feed.tsx` to integrate the comment toggle and `CommentThread`
  - Add `expandedComments: Set<string>` state (tracks which post IDs have their thread open); initialise as `new Set()`
  - Add `commentCounts: Record<string, number>` state; initialise from `post.commentsCount` when posts are loaded (update in the `setPosts` call)
  - Replace the static `<span>{post.commentsCount} {post.commentsCount === 1 ? 'Comment' : 'Comments'}</span>` in both post card render paths with a `<button>` that:
    - Displays `{commentCounts[post.id] ?? post.commentsCount} {(commentCounts[post.id] ?? post.commentsCount) === 1 ? 'Comment' : 'Comments'}`
    - On click, toggles the post's ID in `expandedComments`
    - Has `className="comments-toggle-button"`
  - Below the post footer, conditionally render `<CommentThread>` when `expandedComments.has(post.id)`, passing:
    - `postId={post.id}`
    - `currentUserId` from `useAuth()` context (add `userId` to the auth context if not already present, or derive from the token)
    - `onCommentAdded={() => setCommentCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? post.commentsCount) + 1 }))}`
    - `onCommentDeleted={() => setCommentCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? post.commentsCount) - 1) }))}`
  - Initialise `commentCounts` when posts are set: after `setPosts(...)`, also call `setCommentCounts(prev => ({ ...prev, ...Object.fromEntries(postsWithUsers.map(p => [p.id, p.commentsCount])) }))`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.3_

  - [ ]* 9.1 Write unit tests for the comment toggle in `Feed`
    - Test: clicking the comments toggle opens the `CommentThread` for that post
    - Test: clicking the toggle again closes the `CommentThread`
    - _Requirements: 5.1, 5.3_

  - [ ]* 9.2 Write property test — Property 8: Comment count label pluralisation
    - `// Feature: post-comments, Property 8: Comment count label pluralisation`
    - Generate random integers ≠ 1 (for plural) and the fixed value 1 (for singular) using fast-check
    - Assert: rendered output contains "Comments" (plural) for all counts ≠ 1, and "Comment" (singular) for count = 1
    - Run minimum 100 iterations
    - _Requirements: 4.2, 4.3_

- [x] 10. Add CSS styles for the comment thread UI
  - Add styles to `frontend/src/index.css` (or `App.css`) for the following class names used by `CommentThread` and the updated `Feed`:
    - `.comments-toggle-button` — styled consistently with `.like-button`; no underline; cursor pointer
    - `.comment-thread` — container below the post footer; padding; border-top
    - `.comment-item` — individual comment row; flex layout with content and delete button
    - `.comment-author` — bold username
    - `.comment-date` — muted small text
    - `.comment-content` — comment body text
    - `.comment-delete-button` — small, muted delete button; only visible on hover of `.comment-item`
    - `.comment-compose` — compose area; flex row with input and submit button
    - `.comment-input` — text input; flex-grow 1
    - `.comment-submit-button` — submit button
    - `.comment-error` — inline error message; red text
  - _Requirements: 5.1, 5.2, 5.4, 5.6_

- [x] 11. Final checkpoint — full feature wired end-to-end
  - Ensure all backend and frontend tests pass, ask the user if questions arise.
  - Verify TypeScript compiles without errors: `yarn build:frontend` (tsc + vite build)
  - Verify the backend build succeeds: `yarn build:backend`
  - Verify the CDK stack synthesises without errors: `yarn workspace infrastructure cdk synth`

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The backend handlers follow the exact CommonJS pattern of `likePost.js` — use it as the reference implementation
- `commentsCount` is updated atomically with DynamoDB `ADD` expressions; the decrement uses a `ConditionExpression` to floor at 0
- Property tests use fast-check (added in task 1); unit tests use the existing Jest setup in `backend/package.json`
- The `postId-index` GSI already exists in the CDK stack — no DynamoDB schema changes are needed
- `withAuth` middleware injects `event.user.id` and `event.user.username`; handlers can use these directly without additional Cognito calls