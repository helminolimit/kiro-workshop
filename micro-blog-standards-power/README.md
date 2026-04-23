# Micro Blog Standards Power

A comprehensive Kiro Power that packages coding standards and conventions for the Micro Blogging App project.

## Installation

To use this Power in your Kiro environment:

1. Copy the `micro-blog-standards-power` directory to your Kiro Powers location
2. Activate the Power using Kiro's Power management interface
3. Access the standards through the Power activation commands

## What's Included

This Power contains comprehensive documentation for:

- **Frontend Conventions** - React 18 + TypeScript patterns, hooks, styling, and component structure
- **Backend Conventions** - Node.js Lambda handlers, AWS SDK usage, authentication, and error handling
- **Infrastructure Conventions** - AWS CDK patterns, resource naming, IAM permissions, and deployment
- **API Conventions** - REST endpoint design, request/response formats, and error handling

## Usage

### Activate the Power

```
action="activate", powerName="micro-blog-standards"
```

This loads the complete documentation and shows all available steering files.

### Read Specific Standards

```
action="readSteering", powerName="micro-blog-standards", steeringFile="frontend-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="backend-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="infrastructure-conventions.md"
action="readSteering", powerName="micro-blog-standards", steeringFile="api-conventions.md"
```

## Structure

```
micro-blog-standards-power/
├── power.json                          # Power metadata and configuration
├── POWER.md                            # Main Power documentation
├── README.md                           # This file
└── steering/                           # Steering content
    ├── frontend-conventions.md         # React + TypeScript standards
    ├── backend-conventions.md          # Lambda + AWS SDK standards
    ├── infrastructure-conventions.md   # CDK + AWS resource standards
    └── api-conventions.md              # REST API design standards
```

## Keywords

This Power can be activated when discussing:
- conventions
- standards
- coding standards
- style guide
- best practices
- react
- lambda
- cdk
- typescript
- nodejs

## Tech Stack Coverage

- **Frontend**: React 18, TypeScript (strict), Vite 4, React Router v6
- **Backend**: Node.js 22 Lambda, JavaScript (CommonJS), AWS SDK v3
- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Database**: DynamoDB (on-demand billing)
- **Auth**: AWS Cognito with JWT
- **API**: API Gateway REST API
- **Hosting**: S3 + CloudFront

## Contributing

To update these standards:

1. Edit the relevant steering file in the `steering/` directory
2. Update the version in `power.json`
3. Update the "Last Updated" date in `POWER.md`
4. Distribute the updated Power to team members

## Version

**Current Version**: 1.0.0  
**Last Updated**: 2026-04-23

## License

MIT
