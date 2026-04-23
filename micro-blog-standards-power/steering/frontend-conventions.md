# Frontend Conventions

## React + TypeScript Standards

### Component Structure

#### Functional Components with TypeScript
```typescript
import React, { useState, useEffect } from 'react';
import { ComponentProps } from '../types/component';

const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<StateType>(initialValue);
  
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  return (
    <div className="component-name">
      {/* JSX content */}
    </div>
  );
};

export default ComponentName;
```

**Rules:**
- Use `React.FC<PropsType>` for all functional components
- Define prop interfaces in separate type files when shared, inline for component-specific props
- Use descriptive component names in PascalCase
- Export as default for page components, named exports for utilities

### Hook Usage Patterns

#### State Management
```typescript
// Simple state
const [loading, setLoading] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<DataType[]>([]);

// Complex state updates
setPosts(prevPosts => [...prevPosts, ...newPosts]);
setComments(prev => prev.filter(c => c.id !== commentId));
```

**Rules:**
- Always provide type annotations for useState
- Use functional updates when new state depends on previous state
- Initialize with appropriate default values (empty arrays, null for optional data)

#### Effect Hooks
```typescript
// Data fetching
useEffect(() => {
  const fetchData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getData(token);
      setData(data);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, [token, dependency]);
```

**Rules:**
- Always include dependency arrays
- Handle loading and error states
- Clean up subscriptions/timers in return function
- Use async functions inside useEffect, not async useEffect directly

#### Custom Hooks
```typescript
// Use context hooks
const { token, user } = useAuth();

// Ref hooks for DOM access
const observer = useRef<IntersectionObserver | null>(null);
const lastElementRef = useCallback((node: HTMLElement | null) => {
  // Callback ref logic
}, [dependencies]);
```

### API Integration Patterns

#### Service Layer Organization
```typescript
// frontend/src/services/api.ts
const API_URL = import.meta.env.VITE_API_URL;

export const domainApi = {
  getResource: async (id: string, token: string): Promise<{ resource: Resource }> => {
    console.log(`Making request to: ${API_URL}/resources/${id}`);
    const response = await fetch(`${API_URL}/resources/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
  
  createResource: async (data: CreateData, token: string): Promise<{ resource: Resource }> => {
    const response = await fetch(`${API_URL}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};
```

**Rules:**
- Group API calls by domain (authApi, usersApi, postsApi, commentsApi)
- Always use `import.meta.env.VITE_API_URL` for base URL
- Include console.log for debugging API calls
- Use `handleResponse` helper for consistent error handling
- Pass token explicitly to all authenticated endpoints
- Return typed promises with response shape

#### Error Handling
```typescript
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }
  return response.json();
};
```

### Component Patterns

#### Loading States
```typescript
{loading && (
  <div className="loading">
    <div className="spinner" role="status" aria-label="Loading content" />
  </div>
)}
```

#### Error States
```typescript
{error && <div className="error-message">{error}</div>}
```

#### Empty States
```typescript
{items.length === 0 && !loading && (
  <p>No items yet. Be the first to create one!</p>
)}
```

#### Conditional Rendering
```typescript
{user && (
  <div className="user-info">
    <span>{user.displayName}</span>
  </div>
)}

{isFollowing ? (
  <button className="following">Following</button>
) : (
  <button onClick={handleFollow}>Follow</button>
)}
```

### Event Handlers

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!token || !content.trim()) return;
  
  setSubmitting(true);
  setError(null);
  
  try {
    const data = await api.create(content, token);
    setContent('');
    onSuccess(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Operation failed');
  } finally {
    setSubmitting(false);
  }
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};
```

**Rules:**
- Prefix handlers with `handle`
- Type event parameters properly
- Prevent default for form submissions
- Validate input before API calls
- Handle errors gracefully
- Update UI state appropriately

### Styling Conventions

#### CSS Class Naming
```typescript
// Component-specific classes
<div className="feed-layout">
  <div className="feed-main">
    <div className="post-card">
      <div className="post-header">
        <span className="post-date">{date}</span>
      </div>
      <div className="post-content">{content}</div>
      <div className="post-footer">
        <button className="like-button">Like</button>
      </div>
    </div>
  </div>
</div>
```

**Rules:**
- Use kebab-case for CSS classes
- Use component-name prefix for component-specific styles
- Use semantic names (header, content, footer)
- Use state classes for dynamic styles (liked, following, disabled)

#### Dynamic Classes
```typescript
<button
  className={`like-button ${post.liked ? 'liked' : ''}`}
  disabled={post.liked}
>
  {post.likesCount} Likes
</button>
```

### Type Definitions

#### Props Interfaces
```typescript
interface CommentThreadProps {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}
```

#### Type Files
```typescript
// frontend/src/types/post.ts
export interface Post {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  liked?: boolean;
  user?: User;
}
```

**Rules:**
- Define shared types in `frontend/src/types/` directory
- One type file per domain (user.ts, post.ts, comment.ts)
- Use interfaces for object shapes
- Mark optional properties with `?`
- Export all types

### Routing Patterns

```typescript
import { Link } from 'react-router-dom';

// Navigation links
<Link to={`/profile/${userId}`} className="user-link">
  {displayName}
</Link>

// Programmatic navigation
const navigate = useNavigate();
navigate('/feed');
```

### Context Usage

```typescript
// Using AuthContext
import { useAuth } from '../contexts/AuthContext';

const Component: React.FC = () => {
  const { token, user, login, logout } = useAuth();
  
  // Use context values
};
```

### Form Patterns

```typescript
<form onSubmit={handleSubmit}>
  <div className="form-group">
    <label htmlFor="content">Content</label>
    <textarea
      id="content"
      value={content}
      onChange={(e) => setContent(e.target.value)}
      placeholder="What's on your mind?"
      maxLength={280}
      disabled={submitting}
    />
  </div>
  <button type="submit" disabled={submitting || !content.trim()}>
    {submitting ? 'Posting...' : 'Post'}
  </button>
</form>
```

**Rules:**
- Use controlled components
- Provide labels for accessibility
- Show character counts for limited inputs
- Disable during submission
- Show loading states on buttons

### Date Formatting

```typescript
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};
```

### Performance Patterns

#### Infinite Scroll with Intersection Observer
```typescript
const observer = useRef<IntersectionObserver | null>(null);
const lastElementRef = useCallback((node: HTMLDivElement | null) => {
  if (loading) return;
  if (observer.current) observer.current.disconnect();
  
  observer.current = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && nextToken) {
      fetchMore(nextToken);
    }
  });
  
  if (node) observer.current.observe(node);
}, [loading, nextToken]);
```

#### Memoization
```typescript
// Use useMemo for expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}, [items]);

// Use useCallback for stable function references
const handleClick = useCallback(() => {
  doSomething(dependency);
}, [dependency]);
```

## File Organization

```
frontend/src/
├── components/       # Reusable UI components
│   ├── CommentThread.tsx
│   ├── ErrorBoundary.tsx
│   └── ApiUrlDisplay.tsx
├── contexts/         # React context providers
│   └── AuthContext.tsx
├── pages/            # Route-level page components
│   ├── Feed.tsx
│   ├── Profile.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── CreatePost.tsx
├── services/         # API integration layer
│   └── api.ts
├── types/            # TypeScript type definitions
│   ├── user.ts
│   ├── post.ts
│   └── comment.ts
├── App.tsx           # Main app component with routing
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Environment Variables

```typescript
// Access environment variables
const apiUrl = import.meta.env.VITE_API_URL;
const userPoolId = import.meta.env.VITE_USER_POOL_ID;

// Always prefix with VITE_ for Vite to expose them
```

## Testing Considerations

- Use Playwright for E2E testing
- Test user flows, not implementation details
- Focus on critical paths (auth, post creation, interactions)

## Accessibility

- Use semantic HTML elements
- Provide `aria-label` for icon buttons
- Include `role` attributes for custom elements
- Ensure keyboard navigation works
- Maintain sufficient color contrast
