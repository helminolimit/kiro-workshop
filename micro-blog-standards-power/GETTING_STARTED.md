# Getting Started with Micro Blog Standards Power

## Quick Start

This Power provides comprehensive coding standards for the Micro Blogging App project. Here's how to get started:

### 1. Activate the Power

When working on the Micro Blogging App, activate this Power to load all standards:

```
action="activate", powerName="micro-blog-standards"
```

### 2. Choose Your Area

Depending on what you're working on, read the relevant standards:

#### Working on Frontend?
```
action="readSteering", powerName="micro-blog-standards", steeringFile="frontend-conventions.md"
```

#### Working on Backend?
```
action="readSteering", powerName="micro-blog-standards", steeringFile="backend-conventions.md"
```

#### Working on Infrastructure?
```
action="readSteering", powerName="micro-blog-standards", steeringFile="infrastructure-conventions.md"
```

#### Designing API Endpoints?
```
action="readSteering", powerName="micro-blog-standards", steeringFile="api-conventions.md"
```

#### Need Quick Reference?
```
action="readSteering", powerName="micro-blog-standards", steeringFile="quick-reference.md"
```

## Common Scenarios

### Scenario 1: Creating a New React Component

1. Read frontend conventions
2. Follow the component template pattern
3. Use TypeScript with proper typing
4. Include loading and error states
5. Follow CSS naming conventions

**Key Files:**
- `frontend-conventions.md` - Component patterns
- `quick-reference.md` - Component template

### Scenario 2: Adding a New Lambda Function

1. Read backend conventions
2. Follow the handler structure pattern
3. Initialize AWS SDK clients at module level
4. Validate input and environment variables
5. Return consistent response format

**Key Files:**
- `backend-conventions.md` - Handler patterns
- `quick-reference.md` - Lambda template

### Scenario 3: Adding Infrastructure Resources

1. Read infrastructure conventions
2. Follow CDK construct patterns
3. Use proper naming conventions
4. Grant appropriate IAM permissions
5. Create necessary outputs

**Key Files:**
- `infrastructure-conventions.md` - CDK patterns
- `quick-reference.md` - Resource templates

### Scenario 4: Designing a New API Endpoint

1. Read API conventions
2. Follow REST naming standards
3. Use appropriate HTTP methods
4. Define request/response formats
5. Document error responses

**Key Files:**
- `api-conventions.md` - API design
- `quick-reference.md` - Response formats

## Learning Path

### For New Team Members

**Week 1: Understand the Stack**
1. Read `POWER.md` for overview
2. Review `quick-reference.md` for common patterns
3. Explore existing code with standards in mind

**Week 2: Frontend Development**
1. Study `frontend-conventions.md` thoroughly
2. Review existing React components
3. Practice with small component changes

**Week 3: Backend Development**
1. Study `backend-conventions.md` thoroughly
2. Review existing Lambda handlers
3. Practice with simple handler modifications

**Week 4: Full Stack**
1. Study `infrastructure-conventions.md`
2. Study `api-conventions.md`
3. Implement a complete feature end-to-end

### For Experienced Developers

**Quick Onboarding (1-2 days)**
1. Skim `POWER.md` for overview
2. Read `quick-reference.md` for patterns
3. Reference specific conventions as needed
4. Review code examples in each convention file

## Best Practices for Using This Power

### During Development

1. **Before Starting**: Activate the Power and review relevant conventions
2. **During Coding**: Keep quick reference open for templates
3. **Before Committing**: Verify code matches standards
4. **During Review**: Reference standards in code review comments

### During Code Review

1. Check adherence to naming conventions
2. Verify error handling patterns
3. Confirm response format consistency
4. Validate TypeScript typing
5. Review IAM permissions

### When Onboarding

1. Share this Power with new team members
2. Walk through relevant conventions together
3. Pair program using the standards
4. Reference standards in PR feedback

## Troubleshooting

### "I can't find a pattern for X"

1. Check `quick-reference.md` first
2. Search the relevant convention file
3. Look at existing code for similar patterns
4. Ask the team if pattern exists

### "The standard seems outdated"

1. Verify against current codebase
2. Discuss with team
3. Update the convention file if needed
4. Increment version in `power.json`

### "Standards conflict with each other"

1. Check which is more recent
2. Consult with team lead
3. Update conflicting standard
4. Document the decision

## Contributing to Standards

### Proposing Changes

1. Identify the issue or improvement
2. Draft the proposed change
3. Discuss with team
4. Update relevant convention file
5. Update version and date

### Adding New Patterns

1. Identify the new pattern need
2. Document with examples
3. Add to appropriate convention file
4. Update quick reference if commonly used
5. Announce to team

## Support

For questions about these standards:
- Consult with senior team members
- Review existing code for examples
- Discuss in team meetings
- Update documentation as needed

## Version History

- **1.0.0** (2026-04-23) - Initial release
  - Frontend conventions
  - Backend conventions
  - Infrastructure conventions
  - API conventions
  - Quick reference guide

## Next Steps

1. Activate the Power
2. Read the conventions for your current work
3. Apply the patterns in your code
4. Share feedback with the team
5. Help improve the standards

---

**Remember**: These standards exist to help maintain consistency and quality. When in doubt, follow the patterns in existing code and ask the team!
