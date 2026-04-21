# Tech Stack

## Monorepo Structure
Yarn workspaces with three packages: `frontend`, `backend`, `infrastructure`.

## Frontend
- **Framework**: React 18 with TypeScript (strict mode)
- **Build tool**: Vite 4
- **Routing**: React Router v6
- **Styling**: Plain CSS (no CSS framework)
- **Testing**: Playwright (E2E only)
- **Linting**: ESLint with TypeScript and React Hooks plugins
- **Environment**: `VITE_API_URL` must be set in `frontend/.env`

## Backend
- **Runtime**: Node.js 22 (AWS Lambda)
- **Language**: JavaScript (CommonJS modules) — not TypeScript despite tsconfig presence
- **AWS SDKs**: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-cognito-identity-provider`
- **Auth**: JWT decoded from Cognito IdToken; `withAuth` middleware in `backend/src/common/middleware.js` wraps protected handlers
- **ID generation**: `uuid` v9

## Infrastructure
- **IaC**: AWS CDK v2 (TypeScript)
- **Stack**: `MicroBloggingAppStack`
- **Services**: API Gateway REST API, Lambda (Node 22), DynamoDB (on-demand), Cognito User Pool + Identity Pool, S3 + CloudFront (frontend hosting)

## Common Commands

### Frontend
```bash
yarn start:frontend        # Dev server (Vite)
yarn build:frontend        # TypeScript check + Vite build
yarn workspace frontend lint
yarn workspace frontend test:e2e
```

### Backend
```bash
yarn build:backend         # Copies src/ to dist/, strips .ts files
```

### Infrastructure
```bash
yarn deploy:infra          # cdk deploy
yarn workspace infrastructure diff   # cdk diff
```

### Full Deploy
```bash
yarn deploy                # build:backend → deploy:infra → deploy:frontend → CloudFront invalidation
```
