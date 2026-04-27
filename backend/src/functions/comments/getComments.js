const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
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

    const commentsTableName = process.env.COMMENTS_TABLE;

    if (!commentsTableName) {
      throw new Error('Required environment variables are not set');
    }

    // Query comments for the post using the postId-index GSI
    // Note: We don't verify post existence first - if the post doesn't exist,
    // we'll simply return an empty array, which is the correct behavior
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
    console.error('Error getting comments for post:', event.pathParameters?.postId, err);

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
