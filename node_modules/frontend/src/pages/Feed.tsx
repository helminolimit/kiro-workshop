import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Post } from '../types/post';
import { User } from '../types/user';
import { postsApi, usersApi } from '../services/api';
import CommentThread from '../components/CommentThread';

/** Number of posts to fetch per page for infinite scroll pagination */
const POSTS_PER_PAGE = 10;

/**
 * Feed component displays a paginated, sortable list of posts with infinite scroll.
 * 
 * Features:
 * - Infinite scroll pagination using Intersection Observer API
 * - Sort by newest or most popular posts
 * - Optimistic UI updates for likes
 * - User data caching to reduce API calls
 * - Expandable comment threads
 * 
 * @component
 * @example
 * ```tsx
 * <Feed />
 * ```
 */
const Feed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  /** Tracks whether a fetch operation is in progress to prevent duplicate requests */
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pagination token for fetching the next page of posts */
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  /** Set of post IDs with expanded comment threads */
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  /** Maps post IDs to their current comment counts (updated when comments are added/deleted) */
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const { token, user } = useAuth();
  const observer = useRef<IntersectionObserver | null>(null);
  /** Cache to store user data and avoid redundant API calls for the same user */
  const userCache = useRef<Map<string, User>>(new Map());
  
  /**
   * Callback ref for the last post element to trigger infinite scroll.
   * Uses Intersection Observer to detect when the last post becomes visible
   * and automatically fetches the next page.
   * 
   * @param node - The DOM node of the last post element
   */
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || isFetching) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextToken) {
        fetchPosts(nextToken);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, isFetching, nextToken]);

  /**
   * Fetches posts from the API with pagination support.
   * Enriches each post with user data, using a cache to minimize API calls.
   * 
   * @param nextToken - Optional pagination token to fetch the next page of results
   * @returns Promise that resolves when posts are fetched and state is updated
   */
  const fetchPosts = async (nextToken?: string | null) => {
    if (!token || isFetching) return;
    
    try {
      setIsFetching(true);
      setLoading(true);
      setError(null);
      
      const data = await postsApi.getPosts(token, {
        limit: POSTS_PER_PAGE,
        sortBy,
        nextToken: nextToken || undefined
      });
      
      // Fetch user info for each post with caching to reduce redundant API calls
      const postsWithUsers = await Promise.all(
        data.posts.map(async (post: Post) => {
          try {
            // Check cache first
            if (userCache.current.has(post.userId)) {
              return { ...post, user: userCache.current.get(post.userId) };
            }
            
            // Fetch and cache user data
            const userData = await usersApi.getProfile(post.userId, token);
            userCache.current.set(post.userId, userData.user);
            return { ...post, user: userData.user };
          } catch (error) {
            console.error('Error fetching user data for post:', post.id, error);
            return { 
              ...post, 
              user: { 
                id: post.userId, 
                displayName: 'Unknown User',
                username: 'unknown',
                bio: '',
                followersCount: 0,
                followingCount: 0,
                createdAt: ''
              } 
            };
          }
        })
      );
      
      setPosts(prevPosts => nextToken ? [...prevPosts, ...postsWithUsers] : postsWithUsers);
      setCommentCounts(prev => ({ ...prev, ...Object.fromEntries(postsWithUsers.map(p => [p.id, p.commentsCount])) }));
      setNextToken(data.nextToken);
    } catch (err) {
      setError('Failed to load posts. Please try again later.');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (token) {
      setPosts([]);
      setNextToken(null);
      userCache.current.clear(); // Clear cache when sorting changes
      fetchPosts();
    }
  }, [token, sortBy]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, []);

  /**
   * Formats an ISO date string into a localized date and time string.
   * 
   * @param dateString - ISO 8601 date string
   * @returns Localized date and time string (e.g., "1/15/2024, 10:30:00 AM")
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  /**
   * Handles liking a post with optimistic UI updates.
   * Updates the UI immediately, then makes the API call.
   * Rolls back the change if the API call fails.
   * 
   * @param postId - ID of the post to like
   */
  const handleLike = async (postId: string) => {
    if (!token) return;
    
    // Optimistic update
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, likesCount: post.likesCount + 1, liked: true } 
          : post
      )
    );
    
    try {
      await postsApi.likePost(postId, token);
    } catch (err) {
      console.error('Error liking post:', err);
      
      // Rollback on failure
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, likesCount: post.likesCount - 1, liked: false } 
            : post
        )
      );
      setError('Failed to like post. Please try again.');
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  /**
   * Handles changes to the sort dropdown.
   * Validates the selected value and updates the sort state.
   * 
   * @param e - Change event from the select element
   */
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'newest' || value === 'popular') {
      setSortBy(value);
    } else {
      console.error('Invalid sort value:', value);
    }
  };

  /**
   * Toggles the visibility of the comment thread for a specific post.
   * 
   * @param postId - ID of the post whose comments should be toggled
   */
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => new Set(prev.has(postId) ? [...prev].filter(x => x !== postId) : [...prev, postId]));
  };

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <div className="feed">
          <div className="feed-header">
            <h2>Recent</h2>
          </div>
          <div className="feed-controls">
            <label htmlFor="sort-by">Sort by:</label>
            <select 
              id="sort-by" 
              value={sortBy} 
              onChange={handleSortChange}
              className="sort-select"
            >
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
            </select>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="posts-list">
            {posts.length === 0 && !loading ? (
              <p>No posts yet. Be the first to post!</p>
            ) : (
              posts.map((post, index) => {
                const isLast = posts.length === index + 1;
                const displayCount = commentCounts[post.id] ?? post.commentsCount;
                return (
                  <div
                    ref={isLast ? lastPostElementRef : undefined}
                    key={post.id}
                    className="post-card"
                  >
                    <div className="post-header">
                      <Link to={`/profile/${post.userId}`} className="user-link">
                        {post.user ? post.user.displayName : 'Unknown User'}
                      </Link>
                      <span className="post-date">{formatDate(post.createdAt)}</span>
                    </div>
                    <div className="post-content">{post.content}</div>
                    <div className="post-footer">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`like-button ${post.liked ? 'liked' : ''}`}
                        disabled={post.liked}
                        aria-label={post.liked ? `Liked. ${post.likesCount} likes` : `Like post. Currently ${post.likesCount} likes`}
                      >
                        {post.likesCount} {post.likesCount === 1 ? 'Like' : 'Likes'}
                      </button>
                      <button
                        className="comments-toggle-button"
                        onClick={() => toggleComments(post.id)}
                        aria-label={`${expandedComments.has(post.id) ? 'Hide' : 'Show'} ${displayCount} comments`}
                        aria-expanded={expandedComments.has(post.id)}
                      >
                        {displayCount} {displayCount === 1 ? 'Comment' : 'Comments'}
                      </button>
                    </div>
                    {expandedComments.has(post.id) && (
                      <CommentThread
                        postId={post.id}
                        currentUserId={user?.id ?? ''}
                        onCommentAdded={() => setCommentCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? post.commentsCount) + 1 }))}
                        onCommentDeleted={() => setCommentCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] ?? post.commentsCount) - 1) }))}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {loading && (
            <div className="loading">
              <div className="spinner" role="status" aria-label="Loading posts" />
            </div>
          )}
        </div>
      </div>
      
      <div className="feed-sidebar">
        <div className="feed-sidebar-placeholder">
          <p>Future content area</p>
          <p>This space is reserved for upcoming features like trending topics, suggested users, or advertisements.</p>
        </div>
      </div>
    </div>
  );
};

export default Feed;
