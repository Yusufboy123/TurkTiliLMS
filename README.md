# Turk Tili LMS

Turk Tili LMS is the initial foundation for a scalable Turkish language learning
platform. The repository is an npm workspace with a React web client and a
versioned Express REST API.

## Architecture

```text
TurkTiliLMS/
├── frontend/          React, Vite, TypeScript, Tailwind CSS
├── backend/           Express, TypeScript, Prisma, PostgreSQL
├── docs/              Architecture decisions
├── package.json       Workspace scripts and shared tooling
└── README.md
```

The frontend communicates with the backend only through `/api/v1` REST
endpoints. This API-first boundary allows future Android, iOS, and Telegram bot
clients to share the same application logic and data access layer. See
[docs/architecture.md](docs/architecture.md) for details.

## Prerequisites

- Node.js 20.19 or later
- npm 10 or later
- PostgreSQL 15 or later
- Git

## Environment setup

Create local environment files from the committed examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Update `backend/.env` with your local PostgreSQL connection string. Environment
files are ignored by Git; never commit real passwords or secrets.

## Installation

After creating the environment files, run this command from the `TurkTiliLMS`
directory:

```bash
npm install
```

npm installs dependencies for the root workspace, frontend, and backend and
runs Prisma Client generation.

The default local URLs are:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API base URL: `http://localhost:5000/api/v1`

No database tables or migrations are included yet.

## Development commands

Run the frontend and backend together:

```bash
npm run dev
```

Run either application separately:

```bash
npm run dev:frontend
npm run dev:backend
```

Quality and production checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run format
```

## Health endpoint

With the backend running, open:

```text
http://localhost:5000/api/v1/health
```

Or test it from a terminal:

```bash
curl http://localhost:5000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "message": "Turk Tili LMS API is running"
}
```

## Current scope

This foundation includes application structure, configuration, API health
monitoring, environment validation, logging, error handling, and Prisma setup.
Authentication, users, lessons, tests, and an admin dashboard are intentionally
deferred.
