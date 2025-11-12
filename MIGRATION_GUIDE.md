# Migration Guide - Monorepo Structure

Your project has been successfully refactored from a split frontend/backend structure to a unified monorepo structure optimized for Vercel deployment.

## What Changed

### Old Structure
```
handyman-tracker/
├── frontend/
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── ...config files
├── backend/
│   ├── package.json
│   └── server.js
└── package.json (old, had outdated deps)
```

### New Structure
```
handyman-tracker/
├── package.json          ← Single root package (one lockfile)
├── vite.config.js
├── index.html
├── src/                  ← Frontend (was frontend/src/)
├── public/               ← Static assets (was frontend/public/)
├── api/                  ← Backend (was backend/server.js)
│   └── server.js
└── dist/                 ← Build output (created by npm run build)
```

## What You Need to Do

### 1. Delete Old Dependencies

The old `frontend/` and `backend/` directories still exist but are empty except for their old `node_modules`. You can safely delete them:

```bash
# Close any terminals/processes running in those directories first
# Then delete the directories manually or run:
rm -rf frontend backend
# or on Windows:
Remove-Item -Recurse -Force frontend, backend
```

**Note:** If you get "file in use" errors, close any terminals, file explorers, or IDEs that might be accessing these folders.

### 2. Install Dependencies

Install all dependencies from the new root package.json:

```bash
npm install
```

This will create a single `node_modules` at the root with all frontend and backend dependencies.

### 3. Update Your Workflow

#### Development Commands (from project root):

**Frontend Development:**
```bash
npm run dev
```
Runs Vite dev server on http://localhost:5173

**Backend Development:**
```bash
npm start
```
Runs Express server on http://localhost:5000

**Build for Production:**
```bash
npm run build
```
Builds the frontend to `dist/` directory

**Lint Code:**
```bash
npm run lint
```

### 4. Environment Variables

Create/update your `.env` file in the **root** directory (not in api/):

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

The backend will automatically load this from the root.

### 5. Vercel Deployment

The project is now optimized for Vercel:

1. **Connect your Git repository to Vercel**

2. **Configure Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add Environment Variables in Vercel Dashboard:**
   - `MONGO_URI` = your MongoDB connection string
   - `JWT_SECRET` = your JWT secret

4. **Deploy!**

Vercel will:
- Automatically detect the `api/` folder and deploy it as serverless functions
- Build your Vite frontend and serve it from the `dist/` directory
- Route `/api/*` requests to your serverless backend

## Files That Were Moved

| Old Location | New Location |
|-------------|-------------|
| `frontend/src/**/*` | `src/**/*` |
| `frontend/public/**/*` | `public/**/*` |
| `frontend/index.html` | `index.html` |
| `frontend/vite.config.js` | `vite.config.js` |
| `frontend/tailwind.config.js` | `tailwind.config.js` |
| `frontend/postcss.config.js` | `postcss.config.js` |
| `frontend/eslint.config.js` | `eslint.config.js` |
| `backend/server.js` | `api/server.js` |

## Benefits of This Structure

✅ **Single dependency tree** - One `package.json`, one `node_modules`, one lockfile
✅ **Optimized for Vercel** - Automatic serverless function detection
✅ **Simpler deployment** - No need for separate frontend/backend deploys
✅ **Better DX** - All code in one place, easier to navigate
✅ **Faster installs** - No duplicate dependencies

## Troubleshooting

### "Module not found" errors
Make sure you've run `npm install` in the root directory.

### Backend not starting
Ensure your `.env` file is in the root directory with valid `MONGO_URI` and `JWT_SECRET`.

### Old directories won't delete
Close any terminals, file explorers, or IDEs accessing those directories, then try again.

### API calls failing
Check that:
- Backend is running on port 5000
- Vite proxy is configured correctly in `vite.config.js`
- API_BASE_URL in `src/config/api.js` is correct

## Next Steps

1. ✅ Delete old `frontend/` and `backend/` directories
2. ✅ Run `npm install` in the root
3. ✅ Create `.env` file in root
4. ✅ Test development mode: `npm run dev` and `npm start`
5. ✅ Test build: `npm run build`
6. ✅ Deploy to Vercel

## Need Help?

If you encounter any issues:
1. Check this migration guide
2. Review the main `README.md` for usage instructions
3. Check the `test-logging.md` for authentication logging details

