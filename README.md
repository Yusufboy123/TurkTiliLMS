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

Browser authentication uses an `HttpOnly` refresh cookie. For local HTTP
development, keep `FRONTEND_URL=http://localhost:5173` and
`AUTH_REFRESH_COOKIE_SECURE=false`. Production must use the exact approved
HTTPS frontend origin and `AUTH_REFRESH_COOKIE_SECURE=true`; environment
validation rejects an insecure production cookie. See
[Secure Browser Session Transport](docs/SECURE_BROWSER_SESSION_TRANSPORT.md)
for the cookie, CORS, CSRF, rotation, and deployment contract.

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

Apply the database migrations and seed the standard roles and permissions:

```bash
npm exec --workspace=backend -- prisma migrate deploy
npm run db:seed
```

## Local development accounts

The standard seed does **not** create fixed-credential users. To create the
login-capable local accounts below, explicitly opt in from a non-production
environment:

```powershell
$env:SEED_DEVELOPMENT_USERS='true'
npm run db:seed
Remove-Item Env:SEED_DEVELOPMENT_USERS
```

For POSIX shells, run
`SEED_DEVELOPMENT_USERS=true npm run db:seed`.

| Role    | Email                    | Password      |
| ------- | ------------------------ | ------------- |
| Admin   | `admin@turktili.local`   | `Admin123!`   |
| Teacher | `teacher@turktili.local` | `Teacher123!` |
| Student | `student@turktili.local` | `Student123!` |

These fixed credentials are strictly for isolated local development and manual
API verification. Never use or promote these identities, passwords, or a
database containing them to production. Production seed execution rejects the
opt-in flag and fails its safety preflight if any known development identity is
already present; it never silently deletes or changes such an account.

With the non-production opt-in enabled, re-running the seed is idempotent: it
restores each account to an active, verified, unlocked state, replaces its local
password, assigns exactly the documented role, and revokes previous sessions.

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

The backend currently includes authentication and RBAC, user administration,
course, section, lesson, content-block, media, and course-enrollment modules.
The graphical admin dashboard and later learning modules remain intentionally
deferred.
