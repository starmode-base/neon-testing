# Neon Testing

Run integration tests with Neon. Neon Testing manages the lifecycle of [Neon](https://neon.com/) Postgres integration tests.

Currently supports Vitest, but Jest and Bun are around the corner.

# Features

- TypeScript only - no JavaScript support
- ES Modules only - no CommonJS support

## Prerequisites

If you are not already using Neon, set up a Neon project

1. In the [Neon console](https://console.neon.tech/), create a Neon Project
1. In the new Neon project, go to _Settings_ and copy the Neon project ID to .env
1. Go to the organization, go to _Settings_ and then _API keys_ and create an org-wide or project-scoped API key, copy the token
1. Create a .env file

   ```
   NEON_API_KEY="***"
   NEON_PROJECT_ID="yellow-sun-00000000"
   ```

## Learnings

### Using the unpooled endpoint

I initilally used the direct (unpooled neon connection). This works well with the HTTP driver but not with the
