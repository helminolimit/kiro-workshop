# Project Structure

```
/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React context providers (e.g. AuthContext)
│   │   ├── pages/             # Route-level page components
│   │   ├── services/          # API call functions (api.ts)
│   │   └── types/             # Shared TypeScript interfaces (user.ts, post.ts)
│   ├── .env                   # Local env vars (VITE_API_URL, Cognito IDs) — not committed
│   └── .env.example           # Template for required env vars
│
├── backend/                   # Lambda function handlers
│   └── src/
│       ├── common/
│       │   └── middleware.js  # withAuth() — wraps protected handlers
│       └── functions/
│           ├── auth/          # login.js, register.js
│           ├── posts/         # createPost.js, getPosts.js, likePost.js
│           ├── users/         # getProfile.js, updateProfile.js, followUser.js, unfollowUser.js, checkFollowing.js
│           └── monitoring/    # emitCustomMetrics.js
│
├── infrastructure/            # AWS CDK stack
│   ├── bin/app.ts             # CDK app entry point
│   └── lib/app-stack.ts       # All AWS resources defined in one stack
│
└── package.json               # Root — Yarn workspaces + top-level scripts
```

## Conventions

**Backend handlers** follow a consistent pattern:
1. Parse and validate `event.body`
2. Read config from environment variables (table names, pool IDs)
3. Interact with DynamoDB via `DynamoDBDocumentClient`
4. Return a response object with `statusCode`, CORS `headers`, and JSON `body`
5. Protected routes export `withAuth(handler)` — the raw handler receives `event.user.id` and `event.user.username`

**Frontend API calls** are grouped by domain in `frontend/src/services/api.ts` (`authApi`, `usersApi`, `postsApi`). All calls use `fetch` with the `VITE_API_URL` base and pass `Authorization: Bearer <token>` for authenticated endpoints.

**DynamoDB tables**: Users, Posts, Likes, Comments, Follows — all on-demand billing. GSIs are used for secondary lookups (e.g. `username-index` on Users, `userId-index` on Posts).

**Adding a new Lambda function** requires three steps:
1. Create the handler in `backend/src/functions/<domain>/<name>.js`
2. Add a `lambda.Function` construct in `infrastructure/lib/app-stack.ts` with required env vars and IAM grants
3. Wire it to an API Gateway resource/method in the same stack file
