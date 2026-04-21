const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
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
 * Lambda handler for creating a comment on a post
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
    // Validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot be empty' }),
      };
    }

    const { content } = JSON.parse(event.body);

    if (!content || content.trim() === '') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot be empty' }),
      };
    }

    if (content.length > 280) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot exceed 280 characters' }),
      };
    }

    // Get post ID from path parameter
    const postId = event.pathParameters?.postId;

    if (!postId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Missing post ID' }),
      };
    }

    const postsTableName = process.env.POSTS_TABLE;
    const commentsTableName = process.env.COMMENTS_TABLE;

    if (!postsTableName || !commentsTableName) {
      throw new Error('Required environment variables are not set');
    }

    // Verify the post exists
    const getPostCommand = new GetCommand({
      TableName: postsTableName,
      Key: { id: postId },
    });

    const postResult = await ddbDocClient.send(getPostCommand);

    if (!postResult.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Post not found' }),
      };
    }

    // Create the comment
    const commentId = uuidv4();
    const createdAt = new Date().toISOString();

    const comment = {
      id: commentId,
      postId,
      userId: event.user.id,
      username: event.user.username,
      content,
      createdAt,
    };

    const putCommand = new PutCommand({
      TableName: commentsTableName,
      Item: comment,
    });

    await ddbDocClient.send(putCommand);

    // Increment commentsCount on the post
    const updateCommand = new UpdateCommand({
      TableName: postsTableName,
      Key: { id: postId },
      UpdateExpression: 'ADD commentsCount :one',
      ExpressionAttributeValues: {
        ':one': 1,
      },
    });

    await ddbDocClient.send(updateCommand);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ comment }),
    };
  } catch (err) {
    console.error('Error creating comment:', err);

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
