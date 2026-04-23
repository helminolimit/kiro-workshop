# Micro Blogging App - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                      │
└────────────────────────┬────────────────────────────┬────────────────────────┘
                         │                            │
                         │ Browse Frontend            │ API Requests
                         ▼                            ▼
        ┌────────────────────────────┐   ┌───────────────────────────┐
        │      CloudFront CDN        │   │      API Gateway          │
        │   (Content Delivery)       │   │      (REST API)           │
        └────────────┬───────────────┘   └──────────┬────────────────┘
                     │                              │
                     │                              │ JWT Validation
                     ▼                              │
        ┌────────────────────────────┐             │
        │      S3 Bucket             │             │
        │   (React SPA Static        │             │
        │    Files - Vite Build)     │             │
        └────────────────────────────┘             │
                                                    │
                     ┌──────────────────────────────┼──────────────────────┐
                     │                              │                      │
                     │                              ▼                      │
                     │                   ┌──────────────────────┐          │
                     │                   │   Cognito User Pool  │          │
                     │                   │   (Authentication)   │          │
                     │                   └──────────┬───────────┘          │
                     │                              │                      │
                     │                              │ Verify JWT           │
                     │                              │                      │
        ┌────────────▼────────────┐    ┌───────────▼──────────┐           │
        │   Lambda: Auth          │    │   Lambda: Posts      │           │
        │   - login.js            │    │   - createPost.js    │           │
        │   - register.js         │    │   - getPosts.js      │           │
        └────────────┬────────────┘    │   - likePost.js      │           │
                     │                 └───────────┬──────────┘           │
                     │                             │                      │
        ┌────────────▼────────────┐    ┌───────────▼──────────┐           │
        │   Lambda: Users         │    │   Lambda: Comments   │           │
        │   - getProfile.js       │    │   - createComment.js │           │
        │   - updateProfile.js    │    │   - getComments.js   │           │
        │   - followUser.js       │    │   - deleteComment.js │           │
        │   - unfollowUser.js     │    └───────────┬──────────┘           │
        │   - checkFollowing.js   │                │                      │
        └────────────┬────────────┘                │                      │
                     │                             │                      │
                     │                             │                      │
        ┌────────────▼────────────┐                │                      │
        │   Lambda: Monitoring    │                │                      │
        │   - emitCustomMetrics.js│                │                      │
        └─────────────────────────┘                │                      │
                                                    │                      │
        ┌───────────────────────────────────────────┼──────────────────────┘
        │                                           │
        │                    DynamoDB Tables (On-Demand Billing)
        │
        ├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
        ▼             ▼             ▼             ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│   Users   │ │   Posts   │ │   Likes   │ │ Comments  │ │  Follows  │ │  (GSIs)   │
│   Table   │ │   Table   │ │   Table   │ │   Table   │ │   Table   │ │  Indexes  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

## Architecture Components

### Frontend Layer
- **CloudFront**: CDN for global content delivery with low latency
- **S3 Bucket**: Hosts the React SPA built with Vite (static HTML, CSS, JS)

### API Layer
- **API Gateway**: REST API endpoint that routes requests to Lambda functions
- **Cognito User Pool**: Manages user authentication and JWT token generation

### Compute Layer (Lambda Functions)
All Lambda functions run on Node.js 22 runtime:

1. **Auth Functions**
   - `login.js`: Authenticates users and returns JWT tokens
   - `register.js`: Creates new user accounts in Cognito

2. **Posts Functions**
   - `createPost.js`: Creates new posts (280 char limit)
   - `getPosts.js`: Retrieves posts for feed (sorted by newest/popularity)
   - `likePost.js`: Handles post likes

3. **Users Functions**
   - `getProfile.js`: Retrieves user profile information
   - `updateProfile.js`: Updates user bio and display name
   - `followUser.js`: Creates follow relationships
   - `unfollowUser.js`: Removes follow relationships
   - `checkFollowing.js`: Checks if user follows another user

4. **Comments Functions**
   - `createComment.js`: Adds comments to posts
   - `getComments.js`: Retrieves comments for a post
   - `deleteComment.js`: Removes comments

5. **Monitoring Functions**
   - `emitCustomMetrics.js`: Sends custom CloudWatch metrics

### Data Layer (DynamoDB)
All tables use on-demand billing:

- **Users Table**: User profiles, credentials metadata
  - GSI: `username-index` for username lookups
  
- **Posts Table**: Post content and metadata
  - GSI: `userId-index` for user's posts
  
- **Likes Table**: Post like relationships
  
- **Comments Table**: Comment content and relationships
  
- **Follows Table**: User follow relationships

## Security & Authentication Flow

1. User registers/logs in via Cognito
2. Cognito returns JWT IdToken
3. Frontend includes token in `Authorization: Bearer <token>` header
4. API Gateway validates JWT with Cognito
5. Lambda functions use `withAuth` middleware to extract user info
6. Protected handlers receive `event.user.id` and `event.user.username`

## Deployment Flow

```
yarn deploy
    │
    ├─> yarn build:backend (copies src/ to dist/)
    │
    ├─> yarn deploy:infra (CDK deploys all AWS resources)
    │
    └─> yarn deploy:frontend (uploads to S3, invalidates CloudFront)
```

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js 22 Lambda (JavaScript/CommonJS)
- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Database**: DynamoDB (NoSQL)
- **Auth**: AWS Cognito
- **Hosting**: S3 + CloudFront
- **API**: API Gateway REST API

## Key Design Decisions

1. **Serverless Architecture**: No servers to manage, auto-scaling, pay-per-use
2. **Monorepo Structure**: Yarn workspaces for frontend, backend, infrastructure
3. **JWT Authentication**: Stateless auth with Cognito-managed tokens
4. **NoSQL Database**: DynamoDB for flexible schema and high performance
5. **CDN Distribution**: CloudFront for global low-latency content delivery
6. **Infrastructure as Code**: AWS CDK for reproducible deployments
