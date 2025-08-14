# 🏁 Milestone 1 — Foundations (Auth + RBAC + Core Schema)

**Backend**
1. Set up backend project structure
- Create folder structure for routes, services, models, middlewares, and tests.
- Configure TypeScript (if using) or equivalent tooling.
- Add linting & formatting configs.

2. Configure database connection (PostgreSQL)
- Add DB client library.
- Create connection pool configuration using environment variables.

3. Define database schema (Users, Roles)
- Create migration for users table.
- Create migration for roles table.
- Add seed data for roles: Admin, Officer, Crew.

4. Implement password hashing utility
- Use modern KDF (bcrypt, argon2, etc.).
- Unit test hashing + verification.

5. Implement JWT authentication
- Access + refresh tokens.
- Token generation + validation functions.

6. Create Auth routes
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout (optional token blacklist or stateless flow).

7. Implement RBAC middleware
- Check user role against required permissions for routes.
- Return 403 if unauthorized.

8. Add health check endpoint
- GET /health returns app + DB status.

**Frontend**
9. Set up Electron + SPA scaffold
- Electron main process setup.
- Load SPA (React/Vue/Svelte) in renderer.
- Apply LCARS placeholder theme.

10. Implement collapsible sidebar layout
- Basic navigation structure (Dashboard, Crew Stats, Ship Systems, Logs, Diary, Settings).
- Placeholder content pages.

11. Add login page & authentication flow
- Login form with email/password.
- Store tokens securely (renderer-safe IPC).
- Redirect to dashboard on success.

12. Role-based navigation
- Hide/show nav items based on role.

**DevOps / Tooling**
13. Create Dockerfile for backend
- Production-ready image with multistage build.
- .dockerignore configured.

14. Create Dockerfile for frontend
- Build SPA for Electron.
- Serve in dev mode with hot reload.

15. Create Docker Compose for local dev
- rontend, backend, db services.
- Mount volumes for live reload.

16. Seed development DB
- Admin user credentials in .env.dev.

**Testing**
17. Set up test framework for backend
- Jest/Mocha + supertest for API endpoints.
- Separate test DB config.

18. Write unit tests for auth & RBAC
- Login with valid/invalid credentials.
- RBAC check on protected route.

19. Write smoke test for /health endpoint
Should return DB connected status.

✅ Milestone 1 Acceptance Criteria
- Backend supports user authentication & role-based route access.
- Frontend can log in with seeded admin credentials and display role-specific navigation.
- All containers start with docker-compose up.
- Basic tests pass in CI.