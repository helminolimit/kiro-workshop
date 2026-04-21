import React, { useState, useEffect } from 'react';
import { Comment } from '../types/comment';
import { commentsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CommentThreadProps {
  postId: string;
  currentUserId: string;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}

const CommentThread: React.FC<CommentThreadProps> = ({
  postId,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
}) => {
  const { token } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await commentsApi.getComments(postId, token);
        setComments(data.comments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId, token]);

  const handleDelete = async (commentId: string) => {
    if (!token) return;
    try {
      await commentsApi.deleteComment(postId, commentId, token);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCommentContent.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await commentsApi.createComment(postId, newCommentContent, token);
      setComments((prev) => [...prev, data.comment]);
      setNewCommentContent('');
      onCommentAdded();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comment-thread">
      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="comment-error">{error}</div>
      ) : (
        <>
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <span className="comment-author">{comment.username}</span>
              <span className="comment-date">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
              <p className="comment-content">{comment.content}</p>
              {comment.userId === currentUserId && (
                <button
                  className="comment-delete-button"
                  onClick={() => handleDelete(comment.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </>
      )}

      <form className="comment-compose" onSubmit={handleSubmit}>
        <input
          className="comment-input"
          type="text"
          value={newCommentContent}
          onChange={(e) => setNewCommentContent(e.target.value)}
          placeholder="Write a comment..."
          disabled={submitting}
        />
        <button
          className="comment-submit-button"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
        {submitError && <div className="comment-error">{submitError}</div>}
      </form>
    </div>
  );
};

export default CommentThread;
