# Insurance Policy Management System

This workspace contains a React frontend and PHP API for the insurance policy management system.

## Structure

- `src/` React frontend app
- `api/` PHP API starter
- `database/mvp_schema.sql` starter MySQL schema
- `policy-menu-prototype/` original static sidebar prototype

## Frontend

This is a hand-scaffolded Vite + React project.

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

To point the local React app at a backend API, create `.env.local` in the project root:

```bash
VITE_API_BASE=http://localhost/api
```

### Build

```bash
npm run build
```

The generated production frontend files are written to `dist/`.

## PHP API

The API starter is under `api/`.

Keep real DB credentials in a private config file based on `api/config/database.example.php`, or provide generic `DB_*` environment variables.

Current starter endpoint:

- `/api/health`
- `/api/masters/*`

## Database

Use `database/mvp_schema.sql` to create the starter schema.

## Next recommended steps

1. Install frontend packages locally and preview the sidebar shell
2. Create login page and auth flow
3. Build `Customers` master first
4. Then build `Policies` list and `Issue Policy`
