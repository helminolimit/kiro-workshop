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
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Validate request body
    if (!event.body) {
      const response = {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot be empty' }),
      };
      console.log('Returning response:', JSON.stringify(response, null, 2));
      return response;
    }

    let content;
    try {
      const body = JSON.parse(event.body);
      content = body.content;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      const response = {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Invalid JSON in request body' }),
      };
      console.log('Returning response:', JSON.stringify(response, null, 2));
      return response;
    }

    if (!content || content.trim() === '') {
      const response = {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot be empty' }),
      };
      console.log('Returning response:', JSON.stringify(response, null, 2));
      return response;
    }

    if (content.length > 280) {
      const response = {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Comment content cannot exceed 280 characters' }),
      };
      console.log('Returning response:', JSON.stringify(response, null, 2));
      return response;
    }

    // Basic sanitization: trim whitespace and remove null bytes
    const sanitizedContent = content.trim().replace(/\0/g, '');

    // Get post ID from path parameter
    const postId = event.pathParameters?.postId;

    if (!postId) {
      const response = {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Missing post ID' }),
      };
      console.log('Returning response:', JSON.stringify(response, null, 2));
      return response;
    }

    const postsTableName = process.env.POSTS_TABLE;
    const commentsTableName = process.env.COMMENTS_TABLE;

    if (!postsTableName || !commentsTableName) {
      throw new Error('Required environment variables are not set');
    }

    // Create the comment with conditional check that post exists
    // This uses a single atomic operation to verify post existence and increment counter
    const commentId = uuidv4();
    const createdAt = new Date().toISOString();

    const comment = {
      id: commentId,
      postId,
      userId: event.user.id,
      username: event.user.username,
      content: sanitizedContent,
      createdAt,
    };

    // First, atomically increment the post's comment count with a condition that the post exists
    try {
      const updateCommand = new UpdateCommand({
        TableName: postsTableName,
        Key: { id: postId },
        UpdateExpression: 'ADD commentsCount :one',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeValues: {
          ':one': 1,
        },
      });

      await ddbDocClient.send(updateCommand);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        console.error('Post not found:', postId);
        const response = {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Post not found' }),
        };
        console.log('Returning response:', JSON.stringify(response, null, 2));
        return response;
      }
      throw err;
    }

    // Only create the comment if the post update succeeded
    try {
      const putCommand = new PutCommand({
        TableName: commentsTableName,
        Item: comment,
      });

      await ddbDocClient.send(putCommand);
    } catch (err) {
      // If comment creation fails, we need to decrement the counter we just incremented
      console.error('Failed to create comment, rolling back counter:', err);
      try {
        const rollbackCommand = new UpdateCommand({
          TableName: postsTableName,
          Key: { id: postId },
          UpdateExpression: 'ADD commentsCount :negOne',
          ExpressionAttributeValues: {
            ':negOne': -1,
          },
        });
        await ddbDocClient.send(rollbackCommand);
      } catch (rollbackErr) {
        console.error('Failed to rollback counter:', rollbackErr);
      }
      throw err;
    }

    const response = {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ comment }),
    };
    console.log('Returning response:', JSON.stringify(response, null, 2));
    return response;
  } catch (err) {
    console.error('Error creating comment on post:', event.pathParameters?.postId, 'by user:', event.user?.id, err);

    const response = {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Internal server error',
        error: err.message,
      }),
    };
    console.log('Returning response:', JSON.stringify(response, null, 2));
    return response;
  }
};

// Export the handler wrapped with authentication middleware
exports.handler = withAuth(handler);
