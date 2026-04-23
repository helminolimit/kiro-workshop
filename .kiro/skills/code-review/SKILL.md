# Code Review Skill

You are performing a structured code review for the Micro Blogging App. Follow these steps systematically.

## Step 1: Identify File Type

Determine the file category based on its path and content:

- **React Component**: Files in `frontend/src/components/` or `frontend/src/pages/` with `.tsx` extension
- **Lambda Handler**: Files in `backend/src/functions/` with `.js` extension
- **CDK Construct**: Files in `infrastructure/lib/` with `.ts` extension
- **Middleware/Utility**: Files in `backend/src/common/` or `frontend/src/services/`
- **Type Definition**: Files in `frontend/src/types/` with `.ts` extension
- **Other**: Configuration files, scripts, or documentation

## Step 2: Run Type-Specific Checks

### For React Components (.tsx)

1. **TypeScript Interfaces**
   - All props must have explicit TypeScript interfaces
   - No use of `any` type without justification
   - Event handlers should have proper typing (e.g., `React.FormEvent<HTMLFormElement>`)

2. **Error Boundaries**
   - Components that fetch data should be wrapped in ErrorBoundary or have error handling
   - Loading and error states should be handled explicitly

3. **Accessibility**
   - Interactive elements must have appropriate ARIA labels
   - Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<article>`)
   - Forms must have associated labels
   - Images must have alt text

4. **Hook Usage**
   - Hooks must follow Rules of Hooks (only at top level, only in React functions)
   - `useEffect` dependencies must be complete and correct
   - Avoid unnecessary re-renders (check dependency arrays)

5. **State Management**
   - Use appropriate hooks (`useState`, `useContext`, `useReducer`)
   - Avoid prop drilling; use context for deeply nested state

6. **JSDoc Comments**
   - Exported utility functions should have JSDoc comments
   - Custom hooks should document parameters and return values
   - Complex helper functions should explain their purpose
   - Simple component-internal functions may omit JSDoc if self-explanatory

### For Lambda Handlers (.js)

1. **Error Handling**
   - All handlers must have try-catch blocks
   - Errors should return proper HTTP status codes (400, 404, 500)
   - Error messages should be logged but sanitized in responses

2. **Input Validation**
   - Parse and validate `event.body` before use
   - Check for required fields
   - Validate data types and formats (e.g., email, UUID)

3. **Logging**
   - Log important operations (create, update, delete)
   - Include relevant context (userId, resourceId)
   - Use `console.error` for errors, `console.log` for info

4. **AWS SDK v3 Usage**
   - Use modular imports (`@aws-sdk/client-dynamodb`, not `aws-sdk`)
   - Use `DynamoDBDocumentClient` for simplified operations
   - Properly handle AWS SDK errors

5. **Response Format**
   - All responses must include `statusCode`, `headers` (with CORS), and `body`
   - Body must be JSON stringified
   - Use consistent status codes (200, 201, 400, 404, 500)

6. **Authentication**
   - Protected routes must use `withAuth` middleware
   - Access `event.user.id` and `event.user.username` after auth
   - Never trust client-provided user IDs

7. **JSDoc Comments**
   - All exported handler functions should have JSDoc comments
   - Document parameters (especially `event` structure if non-standard)
   - Document return value structure
   - Include `@throws` for expected error conditions
   - Example:
     ```javascript
     /**
      * Creates a new post for the authenticated user.
      * @param {Object} event - API Gateway event
      * @param {string} event.body - JSON string containing post content
      * @param {Object} event.user - User object from withAuth middleware
      * @returns {Promise<Object>} API Gateway response with created post
      * @throws {Error} If content exceeds 280 characters
      */
     exports.handler = withAuth(async (event) => {
       // handler logic
     });
     ```

### For CDK Constructs (.ts)

1. **Construct Naming**
   - Use PascalCase for construct IDs
   - Names should be descriptive and consistent

2. **Removal Policies**
   - Stateful resources (DynamoDB, S3) should have explicit `removalPolicy`
   - Use `RemovalPolicy.RETAIN` for production data
   - Use `RemovalPolicy.DESTROY` only for dev/test environments

3. **IAM Permissions**
   - Follow least-privilege principle
   - Grant specific actions, not wildcards (avoid `dynamodb:*`)
   - Scope permissions to specific resources when possible

4. **Environment Variables**
   - Pass configuration via environment variables, not hardcoded
   - Document required env vars

5. **Resource Organization**
   - Group related resources logically
   - Use comments to separate sections

### For Middleware/Utilities

1. **Reusability**
   - Functions should be pure and testable
   - Avoid side effects where possible
   - Document parameters and return values

2. **Error Handling**
   - Throw meaningful errors
   - Use custom error types if needed

3. **Type Safety**
   - Use TypeScript for frontend utilities
   - Add JSDoc comments for JavaScript utilities

4. **JSDoc Comments (Required)**
   - All exported functions MUST have JSDoc comments
   - Document all parameters with types
   - Document return values with types
   - Include usage examples for complex utilities
   - Example:
     ```javascript
     /**
      * Validates if a string is a valid email address.
      * @param {string} email - The email address to validate
      * @returns {boolean} True if valid email format, false otherwise
      * @example
      * isValidEmail('user@example.com') // returns true
      * isValidEmail('invalid') // returns false
      */
     function isValidEmail(email) {
       return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
     }
     ```

## Step 3: Universal Standards

Check these across all file types:

1. **No Hardcoded Secrets**
   - No API keys, passwords, or tokens in code
   - Use environment variables or AWS Secrets Manager

2. **Naming Conventions**
   - **Variables/Functions**: camelCase (`getUserProfile`, `postId`)
   - **Components/Classes**: PascalCase (`CommentThread`, `AuthContext`)
   - **Constants**: UPPER_SNAKE_CASE (`MAX_POST_LENGTH`, `API_BASE_URL`)
   - **Files**: Match their primary export (component files in PascalCase, utility files in camelCase)

3. **Console Statements**
   - Flag `console.log()` statements that should be removed before production
   - `console.error()` is acceptable for error logging in Lambda handlers
   - `console.warn()` is acceptable for warnings
   - Debug logging should use a proper logging library or be removed
   - Exception: API service files may keep console.log for debugging during development, but should be removed for production

4. **JSDoc Comments**
   - All exported functions should have JSDoc comments
   - Public APIs must document parameters, return values, and examples
   - Complex internal functions should have explanatory JSDoc
   - Simple, self-explanatory functions (e.g., `getFullName(firstName, lastName)`) may omit JSDoc
   - Check for:
     - Missing JSDoc on exported functions
     - Incomplete parameter documentation
     - Missing return type documentation
     - Missing `@throws` for functions that throw errors

5. **Comments**
   - Complex logic should have explanatory comments
   - Avoid obvious comments ("increment i")
   - Use JSDoc for public APIs

6. **Code Duplication**
   - Identify repeated logic that should be extracted
   - Suggest utility functions or custom hooks

7. **Dependencies**
   - Check for unused imports
   - Verify package versions are consistent

## Step 4: Generate Review Summary

Structure your output as follows:

```markdown
# Code Review: [filename]

**File Type**: [React Component | Lambda Handler | CDK Construct | Other]

## Critical Issues ❌

[Issues that must be fixed before deployment]

- **[File:Line]** - [Issue description]
  - **Why it matters**: [Explanation]
  - **Suggested fix**: [Concrete solution]

## Warnings ⚠️

[Issues that should be addressed soon]

- **[File:Line]** - [Issue description]
  - **Why it matters**: [Explanation]
  - **Suggested fix**: [Concrete solution]

## Suggestions 💡

[Nice-to-have improvements]

- **[File:Line]** - [Suggestion description]
  - **Why it matters**: [Explanation]
  - **Suggested fix**: [Concrete solution]

## Passed Checks ✅

[List of standards that were properly followed]

- ✅ [Check description]

## Summary

[Overall assessment and priority recommendations]
```

## Step 5: Provide Actionable Feedback

For each finding:

1. **Be Specific**: Reference exact file paths and line numbers
2. **Explain Impact**: Why does this matter for security, performance, or maintainability?
3. **Offer Solutions**: Provide concrete code examples when possible
4. **Prioritize**: Critical issues first, then warnings, then suggestions

## Review Triggers

This skill should be used when:

- A user asks for a code review
- A user mentions reviewing, checking, or auditing code
- A user wants to ensure code quality before deployment
- A user asks "is this code good?" or similar questions

## Example Usage

User: "Review the createPost.js Lambda handler"

You should:
1. Read `backend/src/functions/posts/createPost.js`
2. Identify it as a Lambda handler
3. Run Lambda-specific checks (error handling, validation, AWS SDK usage)
4. Run universal checks (naming, secrets, comments)
5. Generate the structured review summary
6. Provide specific, actionable feedback

## Notes

- Always read the file before reviewing (never review from memory)
- If reviewing multiple files, provide a summary for each
- Cross-reference with project conventions in `.kiro/steering/` files
- Be constructive and educational in tone
- Acknowledge what's done well, not just problems
