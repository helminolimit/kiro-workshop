const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
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
 * Lambda handler for getting comments for a post
 * @param {Object} event - API Gateway event with user info added by auth middleware
 * @returns {Object} - API Gateway response
 */
const handler = async (event) => {
  try {
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

    // Query comments for the post using the postId-index GSI
    const queryCommand = new QueryCommand({
      TableName: commentsTableName,
      IndexName: 'postId-index',
      KeyConditionExpression: 'postId = :postId',
      ExpressionAttributeValues: {
        ':postId': postId,
      },
      ScanIndexForward: true, // Ascending order by createdAt
    });

    const commentsResult = await ddbDocClient.send(queryCommand);

    const comments = commentsResult.Items || [];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ comments }),
    };
  } catch (err) {
    console.error('Error getting comments:', err);

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
