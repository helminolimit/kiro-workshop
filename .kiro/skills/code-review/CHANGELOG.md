# Code Review Skill Changelog

## 2026-04-23 - JSDoc Comment Checking

### Added
- **JSDoc comment validation** across all file types
  - Checks for missing JSDoc on exported functions
  - Validates completeness of JSDoc (parameters, return values, examples)
  - Context-aware requirements (required for utilities, optional for simple helpers)
  - Comprehensive JSDoc patterns and examples in reference guide

### Updated Files
1. **SKILL.md** - Added JSDoc checks to React Components, Lambda Handlers, Middleware/Utilities, and Universal Standards
2. **reference.md** - Added extensive "JSDoc Comment Patterns" section with examples for:
   - Lambda handler functions
   - Utility functions (JavaScript)
   - Custom React hooks (TypeScript)
   - Middleware functions
   - Guidelines for when JSDoc is required vs optional
3. **examples/react-review-example.md** - Added JSDoc checking example

### JSDoc Requirements Summary

**Required:**
- All exported functions from modules
- Lambda handler functions
- Middleware functions
- Custom React hooks
- Utility functions used across multiple files
- Functions with complex parameters or return types
- Functions that throw errors

**Optional:**
- Private helper functions within a module
- Simple, self-explanatory functions
- Component-internal event handlers
- TypeScript functions where types are already explicit

**Not Required:**
- React component definitions (use TypeScript interfaces)
- Simple arrow functions with obvious purpose
- Inline callback functions

### Example Review Output

```markdown
⚠️ **Line 15** - Missing JSDoc on exported function
- `export function calculateDiscount(price, percentage) { ... }`
- **Why it matters**: Exported functions should document their API for other developers
- **Suggested fix**: Add JSDoc with @param, @returns, and @example tags

💡 **Line 45** - Consider adding JSDoc
- Complex utility function would benefit from documentation
- **Why it matters**: Improves maintainability and helps other developers understand the logic
- **Suggested fix**: Add JSDoc explaining the algorithm and edge cases
```

### Impact
Code reviews will now ensure that public APIs are properly documented, improving code maintainability and developer experience.

---

## 2026-04-23 - Console Statement Detection

### Added
- **Console statement checking** in Universal Standards (Step 3)
  - Flags `console.log()` statements that should be removed before production
  - Distinguishes between acceptable logging (`console.error()`, `console.warn()`) and debug statements
  - Provides context-aware guidance (e.g., Lambda handlers vs React components)

### Updated Files
1. **SKILL.md** - Added "Console Statements" section to Step 3: Universal Standards
2. **reference.md** - Added "Console Statement Guidelines" section with examples
3. **examples/react-review-example.md** - Added console.log detection examples

### Guidelines Summary

**Acceptable Usage:**
- Lambda handlers: `console.error()` for errors, `console.log()` for important operations
- Error boundaries: `console.error()` for caught errors
- Development: Temporary debugging during active development

**Should Be Removed:**
- React components: `console.log()` for debugging state/props
- API services: `console.log()` for request/response logging
- Utilities: Any `console.log()` statements
- Any console statement that doesn't provide production value

### Example Review Output

```markdown
⚠️ **Line 45** - Remove debug console.log statement
- `console.log('User data:', userData);`
- **Why it matters**: Debug logging clutters production logs and may expose sensitive data
- **Suggested fix**: Remove this line or replace with proper logging library

✅ **Line 78** - Appropriate error logging
- `console.error('Failed to fetch user:', error);`
- This is acceptable for production error tracking
```

### Impact
Code reviews will now automatically detect and flag debug console statements, helping maintain cleaner production code and preventing sensitive data exposure through logs.
