# Task - API Service

This repository contains a small TypeScript/Node API using Express and Prisma. The sections below explain how to run the project locally, how to use the service, how to run tests, and a note about work that was not completed.

## Checklist
- Install dependencies
- Configure environment variables
- Run Prisma migrations / generate client
- Run the app (dev or production build)
- Run tests

---

## Prerequisites
- Node.js (v24.11.0 (check `./nvmrc` file))
- npm
- Docker & docker-compose (optional, for running Postgres locally or the full stack)

## Quick start - run locally

1. Clone the repository and change directory:

```bash
git clone https://github.com/boykovm/task.git && cd task
```

2. Install dependencies:

```bash
npm ci
```

3. Create environment file

Create copy of `.env.example` file into `.env` file and fill in env variables. Typical variables used by this project are:

```bash
cp ./.env.example ./.env
```

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME?schema=public
PORT=3000
JWT_SECRET=some-secret
EMAIL_HOST=smtp.example.com
SMTP_PORT=1025
GITHUB_TOKEN=your-GITHUB-token-for-utilizing-GITHUB-API
```

Adjust the values to match your environment. If you prefer to run Postgres via Docker, see the Docker section below.

4. Prisma: generate the client and run migrations

```bash
npx prisma generate
# If you want to apply migrations (will modify DB schema):
npx prisma migrate deploy
```

The Prisma schema file is in `prisma/schema.prisma`.

5. Run the application in development mode:

```bash
npm run dev
```

Or build and run the production bundle:

```bash
npm run build
npm start
```

By default the app listens on the port set in `PORT` (e.g. 3000).

---

## Docker (optional)

If you prefer using Docker, there is a `docker-compose.yml` in the repo. A minimal workflow:

```bash
docker compose up
```

Check the `docker-compose.yml` for service names and configuration.

---

## Usage / API

The API routes are defined under `src/routes` and controllers under `src/controllers`.

Common endpoints (examples - confirm actual routes in `src/routes`):

- POST /subscribe - create a new subscription
- GET /confirm/{token} - confirm a subscription (using a token)
- GET /unsubscribe/{token} - unsubscribe a subscription
- GET /subscriptions?email={email} - list all subscriptions

To explore or call endpoints locally, use curl, HTTPie, or Postman. 

Example creating a subscription:
```bash
curl --location 'http://localhost:3000/api/subscribe' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'email=user@example.com' \
--data-urlencode 'repo=nestjs/nest'
```

Example confirming a subscription (use url/token from email)
```bash
curl --location 'http://localhost:3000/api/confirm/{use_your_token}'
```

Example unsubscribing a subscription (use url/token from email)
```bash
curl --location 'http://localhost:3000/api/unsubscribe/{use_your_token}'
```

Example listing all subscriptions (use email from email)
```bash
curl --location 'http://localhost:3000/api/subscriptions?email={use_your_email}'
```

After creating subscription every 15 mins service will check for new tags in repository and if new tag is found, it will send email to user

### Validating emails (if you are using docker)
In browser open MailHog client `http://localhost:8025`

Here you will be able to see all emails, that was sent by backend service

---

## Testing

Run the project's test suite with:

```bash
npm test
```

There are Jest tests in `src/**/*.test.ts` already

## Code generation / build notes

- TypeScript build: `npm run build` (uses `npx tsc`).
- Dev: `npm run dev` uses `tsx` to run TypeScript directly.

---

## Not done / Known gaps

- End-to-end tests: there are unit tests, but full integration tests (with DB in CI) are not configured.
- Rollback logic if email sending fails
- Adjust rate limiter to use queue and implement retry logic, also, it should return 429/503 status code when limit is exceeded, however it will not complete task, since contract will be changed
- Shutdown logic is not fully done

---

## Where to look in the code

- App entry: `src/index.ts`
- Routes: `src/routes` (e.g., `src/routes/subscription.ts`)
- Controllers: `src/controllers` (e.g., `src/controllers/subscription.ts`)
- Services: `src/services` (email, github, jwt, scheduler)
- Prisma client usage: `lib/prisma.ts` and `generated/prisma` generated client

---
