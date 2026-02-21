# Security

## Environment and secrets

- **Never commit `.env` or any file containing real secrets** (e.g. `MONGO_URI`, `JWT_SECRET`).  
  These are listed in `.gitignore`; keep them only on your machine and in deployment env (e.g. Vercel).

- Before pushing, run:
  ```bash
  npm run check-secrets
  ```
  This fails if any env/secret file is staged for commit.

- **If `.env` or secrets were ever committed** (check with `git log -p -- .env`):
  1. Rotate all secrets immediately: new MongoDB user/password or connection string, new `JWT_SECRET`.
  2. Remove the file from history (e.g. `git filter-repo` or BFG) or create a new repo and re-add only safe files.
  3. Revoke and reissue any exposed credentials (DB, APIs, deployment).

- Use a `.env.example` (no real values) for documenting required variables; it is safe to commit.
