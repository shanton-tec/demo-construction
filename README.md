# Sai Varsha Construction — website + backend

React/Vite frontend with an Express API and PostgreSQL database. The 3D Studio remains a concept visualization tool and is not a substitute for approved architectural, structural, or statutory drawings.

## Backend features added

- Customer registration and sign-in using bcrypt password hashing and short-lived JWTs.
- Admin sign-in using credentials configured on the API host (admin accounts are never created through public registration).
- Role-protected API endpoints.
- Contact enquiries persisted in PostgreSQL and an admin enquiry inbox with status updates.
- Admin project creation and customer-specific project progress/estimate display.
- Rate limits on authentication/enquiry endpoints, security headers, input validation, and CORS allowlisting.
- Health endpoint at `/api/health`.

## Run locally

### 1. Start PostgreSQL

Create a PostgreSQL database locally or with a hosted provider. Keep the database URL private.

### 2. Start the API

```bash
cd server
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET (32+ characters), ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default. On first startup it creates the required tables and creates the initial administrator account if that email is not already present. The initial admin password is read from environment variables; changing the environment password later does not automatically change an existing account's password.

### 3. Start the frontend

In the project root:

```bash
cp .env.example .env.local
npm install
npm run dev
```

`VITE_API_URL=http://localhost:4000` is used for local development. Restart Vite after changing environment variables.

## Deploy

1. Create a managed PostgreSQL database and copy its connection URL.
2. Deploy the `server/` folder as a Node web service (the included `server/render.yaml` is a Render starting point). Set `DATABASE_URL`, a unique `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `CLIENT_ORIGINS` in the service's environment settings. `CLIENT_ORIGINS` must contain the exact deployed frontend origin(s), comma-separated, with no trailing slash.
3. Confirm `https://YOUR-API-HOST/api/health` returns `{ "ok": true, ... }`.
4. In Netlify, set `VITE_API_URL` to the deployed API base URL (no trailing slash), then trigger a fresh frontend deploy. The API host's `CLIENT_ORIGINS` must include the exact Netlify custom-domain and/or `*.netlify.app` site origin you use. Avoid wildcards for production origins.
5. Test registration, sign-in, admin sign-in, contact enquiry submission, enquiry status updates, project assignment, and customer project visibility on the deployed URLs.

## Admin setup and workflow

- The first administrator is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` during API startup.
- Public registration always creates a `customer` role; it cannot choose the admin role.
- Sign in through the Admin tab, then create a project and enter the customer's registered email. The customer sees projects linked to that email.
- Use the enquiry table to move each enquiry through New, Contacted, In progress, and Closed.

## Important limitations before a paid client launch

- This is a backend foundation, not a full enterprise CRM. It does not yet include email verification, password reset, email notifications, file uploads, audit logs, automated backups, or payment processing.
- JWTs are stored in browser localStorage in this starter implementation. For higher-security production use, consider secure HttpOnly cookies and a CSRF strategy.
- Admin project creation is available; editing/deleting projects is exposed in the API but not yet surfaced as dashboard controls.
- Existing sample projects, material rates, imagery, and some marketing metrics still need client approval/replacement.
- Set up database backups and test restoring them before using real customer records.
- Never commit `.env` files or expose database credentials/JWT secrets in the frontend. Only `VITE_*` variables are exposed to the browser.
