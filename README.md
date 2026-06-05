# Insurance Policy Management System

This workspace now contains the first application shell for `insurance.bizskilledu.com`.

## Structure

- `src/` React frontend app
- `api/` PHP API starter for Hostinger shared hosting
- `database/mvp_schema.sql` starter MySQL schema for `u380752258_insurance`
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

If you want the local React app to use the live Hostinger PHP backend, create `.env.local` in the project root:

```bash
VITE_API_BASE=https://insurance.bizskilledu.com/api
```

### Build

```bash
npm run build
```

Upload the generated `dist/` files to your Hostinger public web root when you are ready.

### Build Hostinger deploy package

```bash
npm run build:hostinger
```

This creates a `deploy/` folder containing:
- built React frontend files at the root
- `api/` PHP backend folder
- root `.htaccess` for React route fallback

## PHP API

The API starter is under `api/`.

### Suggested Hostinger structure

- frontend build files in your main public folder
- PHP API files in `api/`
- keep real DB credentials in a private config file based on `api/config/database.example.php`

Current starter endpoint:

- `/api/health`
- `/api/masters/*`

## Database

Use `database/mvp_schema.sql` against:

- `u380752258_insurance`

## GitHub To Hostinger Deployment

Workflow file:

- [.github/workflows/deploy-hostinger.yml](/D:/Insurance%20Policy%20Management%20System/.github/workflows/deploy-hostinger.yml)

Add these GitHub repository secrets before using the workflow:

- `HOSTINGER_FTP_SERVER`
- `HOSTINGER_FTP_USERNAME`
- `HOSTINGER_FTP_PASSWORD`
- `HOSTINGER_TARGET_DIR`
- `HOSTINGER_DB_HOST`
- `HOSTINGER_DB_NAME`
- `HOSTINGER_DB_USER`
- `HOSTINGER_DB_PASSWORD`

For your current DB, likely values will be:

- `HOSTINGER_DB_HOST = srv2057.hstgr.io`
- `HOSTINGER_DB_NAME = u380752258_insurance`
- `HOSTINGER_DB_USER = u380752258_insurance`

`HOSTINGER_TARGET_DIR` should be the actual publish folder for `insurance.bizskilledu.com`, for example something like:

- `/public_html/insurance.bizskilledu.com/`

Please confirm the exact folder path inside Hostinger before the first deploy.

## Next recommended steps

1. Install frontend packages locally and preview the sidebar shell
2. Create login page and auth flow
3. Build `Customers` master first
4. Then build `Policies` list and `Issue Policy`
