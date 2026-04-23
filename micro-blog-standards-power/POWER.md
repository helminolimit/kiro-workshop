# Micro Blog Coding Standards Power

## Overview

This Power packages the comprehensive coding standards and conventions for the Micro Blogging App project. It provides guidance for maintaining consistency across the full-stack serverless application, covering frontend React components, backend Lambda functions, AWS CDK infrastructure, and API design patterns.

## What's Included

This Power bundles steering content that documents:

### 1. **Frontend Standards** (`frontend-conventions.md`)
- React 18 + TypeScript component patterns
- Hook usage and state management conventions
- Styling approach with plain CSS
- Component structure and organization
- Error handling and loading states
- Type safety patterns

### 2. **Backend Standards** (`backend-conventions.md`)
- Node.js 22 Lambda handler patterns
- AWS SDK v3 usage conventions
- Authentication middleware patterns
- Error handling and response formats
- DynamoDB interaction patterns
- Environment variable management

### 3. **Infrastructure Standards** (`infrastructure-conventions.md`)
- AWS CDK v2 construct patterns
- Resource naming conventions
- IAM permission management
- Lambda function configuration
- API Gateway endpoint structure
- DynamoDB table design patterns

### 4. **API Standards** (`api-conventions.md`)
- REST endpoint naming conventions
- Request/response format standards
- Error response patterns
- CORS configuration
- Authentication header requirements
- Status code usage

## How to Use This Power

### Activation

```
action="activate", powerName="micro-blog-standards"
```

This will load the complete documentation and show available steering files.

### Reading Specific Standards

To read detailed conventions for a specific area:

```
action="readSteering", powerName="micro-blog-standards", steeringFile="frontend-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="backend-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="infrastructure-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="api-conventions.md"
```

## When to Use

Use this Power when:

- Starting new feature development to ensure consistency
- Onboarding new team members to the project
- Reviewing code to verify adherence to standards
- Refactoring existing code to match conventions
- Resolving questions about implementation patterns
- Creating new Lambda functions, React components, or CDK constructs

## Key Principles

### Consistency
All code should follow established patterns to maintain readability and reduce cognitive load.

### Type Safety
TypeScript strict mode in frontend, proper typing for all interfaces and props.

### Error Handling
Comprehensive error handling with user-friendly messages and proper logging.

### Security
JWT authentication, proper IAM permissions, input validation, and secure AWS SDK usage.

### Performance
Efficient DynamoDB queries, optimized React rendering, proper Lambda configuration.

### Maintainability
Clear naming, modular code, separation of concerns, and comprehensive documentation.

## Tech Stack Reference

- **Frontend**: React 18, TypeScript (strict), Vite 4, React Router v6
- **Backend**: Node.js 22 Lambda, JavaScript (CommonJS), AWS SDK v3
- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Database**: DynamoDB (on-demand billing)
- **Auth**: AWS Cognito with JWT
- **API**: API Gateway REST API
- **Hosting**: S3 + CloudFront

## Version

**Version**: 1.0.0  
**Last Updated**: 2026-04-23  
**Status**: Active

## Support

For questions or suggestions about these standards, contact the Micro Blogging development team.
