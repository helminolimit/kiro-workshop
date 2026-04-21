const { DynamoDBClient, ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { withAuth } = require('../../common/middleware');

// Initialize clients
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

/**
 * Lambda handler for deleting a comment on a post
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
    const postId = event.pathParameters?.postId;
    const commentId = event.pathParameters?.commentId;

    if (!postId || !commentId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Missing post ID or comment ID' }),
      };
    }

    const postsTableName = process.env.POSTS_TABLE;
    const commentsTableName = process.env.COMMENTS_TABLE;

    if (!postsTableName || !commentsTableName) {
      throw new Error('Required environment variables are not set');
    }

    // Fetch the comment to verify it exists and check ownership
    const getCommentCommand = new GetCommand({
      TableName: commentsTableName,
      Key: { id: commentId },
    });

    const commentResult = await ddbDocClient.send(getCommentCommand);

    if (!commentResult.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment not found' }),
      };
    }

    const comment = commentResult.Item;

    // Check that the requesting user is the comment author
    if (comment.userId !== event.user.id) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'You are not authorized to delete this comment' }),
      };
    }

    // Delete the comment
    const deleteCommand = new DeleteCommand({
      TableName: commentsTableName,
      Key: { id: commentId },
    });

    await ddbDocClient.send(deleteCommand);

    // Decrement commentsCount on the post (only if > 0)
    try {
      const updateCommand = new UpdateCommand({
        TableName: postsTableName,
        Key: { id: postId },
        UpdateExpression: 'ADD commentsCount :negOne',
        ConditionExpression: 'commentsCount > :zero',
        ExpressionAttributeValues: {
          ':negOne': -1,
          ':zero': 0,
        },
      });

      await ddbDocClient.send(updateCommand);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        // commentsCount is already 0 or post doesn't exist — treat as no-op
        console.warn('ConditionalCheckFailedException when decrementing commentsCount — ignoring');
      } else {
        throw err;
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Comment deleted successfully' }),
    };
  } catch (err) {
    console.error('Error deleting comment:', err);

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Internal server error',
        error: err.message,
      }),
    };
  }
};

// Export the handler wrapped with authentication middleware
exports.handler = withAuth(handler);
