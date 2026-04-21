# Requirements Document

## Introduction

This feature adds commenting to the Micro Blogging App. Authenticated users can post text comments on any post in their feed, view all comments on a post, and delete their own comments. The post card in the feed will show a comment count and a toggle to expand/collapse the comment thread inline. The backend uses the existing Comments DynamoDB table (partitioned by `id`, with a `postId-index` GSI sorted by `createdAt`).

## Glossary

- **Comment_Service**: The set of Lambda functions responsible for creating, retrieving, and deleting comments.
- **Comment**: A text reply authored by an authenticated user in response to a specific post. Maximum 280 characters.
- **Post**: A short message (up to 280 characters) created by an authenticated user, as defined by the existing posts feature.
- **Feed**: The paginated list of posts displayed to the authenticated user on the main page.
- **Comment_Thread**: The ordered list of comments associated with a single post, displayed inline beneath the post card.
- **Author**: The authenticated user who created a comment.
- **commentsCount**: A numeric counter stored on a Post item that reflects the total number of comments on that post.

---

## Requirements

### Requirement 1: Add a Comment

**User Story:** As an authenticated user, I want to add a comment to a post, so that I can engage in conversation with other users.

#### Acceptance Criteria

1. WHEN an authenticated user submits a non-empty comment body for a valid post, THE Comment_Service SHALL store the comment in the Comments table with a unique `id`, the `postId`, the author's `userId`, the author's `username`, the `content`, and a `createdAt` ISO 8601 timestamp.
2. WHEN a comment is successfully created, THE Comment_Service SHALL increment the `commentsCount` attribute on the associated Post item by 1.
3. WHEN a comment is successfully created, THE Comment_Service SHALL return HTTP 201 with the created comment object in the response body.
4. IF the request body is missing or the `content` field is absent or empty, THEN THE Comment_Service SHALL return HTTP 400 with a descriptive error message.
5. IF the `content` field exceeds 280 characters, THEN THE Comment_Service SHALL return HTTP 400 with an error message stating the maximum length.
6. IF the referenced `postId` does not exist in the Posts table, THEN THE Comment_Service SHALL return HTTP 404 with an error message indicating the post was not found.

---

### Requirement 2: Retrieve Comments for a Post

**User Story:** As an authenticated user, I want to view all comments on a post, so that I can read the conversation.

#### Acceptance Criteria

1. WHEN an authenticated user requests comments for a valid post, THE Comment_Service SHALL return the comments ordered by `createdAt` ascending (oldest first).
2. WHEN an authenticated user requests comments for a valid post, THE Comment_Service SHALL return HTTP 200 with an array of comment objects, each containing `id`, `postId`, `userId`, `username`, `content`, and `createdAt`.
3. WHEN a post has no comments, THE Comment_Service SHALL return HTTP 200 with an empty array.
4. IF the referenced `postId` does not exist in the Posts table, THEN THE Comment_Service SHALL return HTTP 404 with an error message indicating the post was not found.

---

### Requirement 3: Delete a Comment

**User Story:** As an authenticated user, I want to delete my own comments, so that I can remove content I no longer want to be visible.

#### Acceptance Criteria

1. WHEN the authenticated user who authored a comment requests its deletion, THE Comment_Service SHALL remove the comment from the Comments table.
2. WHEN a comment is successfully deleted, THE Comment_Service SHALL decrement the `commentsCount` attribute on the associated Post item by 1, with a minimum value of 0.
3. WHEN a comment is successfully deleted, THE Comment_Service SHALL return HTTP 200 with a success message.
4. IF the authenticated user requesting deletion is not the Author of the comment, THEN THE Comment_Service SHALL return HTTP 403 with an error message indicating insufficient permissions.
5. IF the `commentId` does not exist in the Comments table, THEN THE Comment_Service SHALL return HTTP 404 with an error message indicating the comment was not found.

---

### Requirement 4: Display Comment Count on Post Cards

**User Story:** As an authenticated user, I want to see how many comments a post has, so that I can gauge engagement before expanding the thread.

#### Acceptance Criteria

1. THE Feed SHALL display the `commentsCount` for each post on the post card.
2. WHEN `commentsCount` is 1, THE Feed SHALL display the label "1 Comment".
3. WHEN `commentsCount` is 0 or greater than 1, THE Feed SHALL display the count followed by "Comments" (e.g., "0 Comments", "3 Comments").
4. WHEN a user successfully submits a new comment, THE Feed SHALL increment the displayed `commentsCount` for that post without requiring a full page reload.
5. WHEN a user successfully deletes a comment, THE Feed SHALL decrement the displayed `commentsCount` for that post without requiring a full page reload.

---

### Requirement 5: Inline Comment Thread on Post Cards

**User Story:** As an authenticated user, I want to expand and collapse the comment thread directly on a post card, so that I can read and participate in conversations without leaving the feed.

#### Acceptance Criteria

1. WHEN a user activates the comments toggle on a post card, THE Feed SHALL fetch and display the Comment_Thread for that post inline beneath the post content.
2. WHEN the Comment_Thread is loading, THE Feed SHALL display a loading indicator in place of the comment list.
3. WHEN the Comment_Thread is visible and a user activates the comments toggle again, THE Feed SHALL hide the Comment_Thread.
4. WHILE the Comment_Thread is visible, THE Feed SHALL display a text input and a submit button for composing a new comment.
5. WHEN a user submits a new comment from the inline form, THE Feed SHALL append the new comment to the bottom of the visible Comment_Thread without requiring a full page reload.
6. WHILE the Comment_Thread is visible, THE Feed SHALL display a delete button on each comment authored by the currently authenticated user.
7. WHEN a user activates the delete button on their own comment, THE Feed SHALL remove that comment from the visible Comment_Thread without requiring a full page reload.
8. IF fetching the Comment_Thread fails, THE Feed SHALL display an error message in place of the comment list.
