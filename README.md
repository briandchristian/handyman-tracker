# Handyman Tracker

A full-stack application for managing handyman projects, customers, and bids.

## Project Structure

```
handyman-tracker/
├── package.json          ← Single root package (one lockfile)
├── vite.config.js        ← Vite configuration
├── index.html            ← Entry HTML file
├── tailwind.config.js    ← Tailwind CSS configuration
├── postcss.config.js     ← PostCSS configuration
├── eslint.config.js      ← ESLint configuration
├── vercel.json           ← Vercel deployment config
├── src/                  ← Frontend code (Vite + React)
│   ├── main.jsx          ← App entry point
│   ├── App.jsx           ← Main App component
│   ├── components/       ← React components
│   ├── config/           ← Configuration files
│   └── utils/            ← Utility functions
├── public/               ← Static assets
│   ├── logo.png
│   └── vite.svg
├── api/                  ← Backend (Express + MongoDB)
│   └── server.js         ← Express server (Vercel serverless compatible)
└── dist/                 ← Build output (created by 'npm run build')
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB database (local or cloud)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd handyman-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (never commit this file — it contains secrets):
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   ```
   See [SECURITY.md](SECURITY.md) for handling secrets and what to do if they are ever exposed.

### Development

Run the frontend development server:
```bash
npm run dev
```

Run the backend server (in a separate terminal):
```bash
npm start
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend running on port 5000.

### Building for Production

Build the frontend:
```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deployment

This project is configured for deployment on Vercel:

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `MONGO_URI` — **must be the same database you use in development** (see below)
   - `JWT_SECRET`
4. Deploy!

**Local vs Vercel: one connection string (no loopback vs cloud logic)**  
The app uses a **single** MongoDB connection everywhere: it reads `process.env.MONGO_URI` and does **not** switch between "local" and "Vercel" databases.

- **Locally:** `MONGO_URI` comes from your **`.env`** file (loaded when you run `npm start` or the API).
- **On Vercel:** `MONGO_URI` comes from **Vercel → Settings → Environment Variables**. There is no `.env` on Vercel; you must set it in the dashboard.

If your local `.env` uses **loopback** (e.g. `mongodb://localhost:27017/...` or `mongodb://127.0.0.1/...`), only your machine can reach that. Vercel runs in the cloud and **cannot** connect to your laptop, so production would need a **remote** URI (e.g. MongoDB Atlas). To have the same data locally and in production, use the **same remote URI** in both places: put your Atlas (or other cloud) connection string in local `.env` and in Vercel’s `MONGO_URI`. Then both environments talk to the same database.

**Why does production show no data?**  
Production and development use different *environments*. If `MONGO_URI` on Vercel is missing, wrong, or points to a different MongoDB (e.g. a new Atlas cluster, a different database name), the production app will fail to connect or read/write that other database—which may be empty. Your local data is in the DB your `.env` uses. To keep one source of truth, set Vercel’s `MONGO_URI` to the **exact same** connection string as in your local `.env` (same Atlas cluster and, if you use one, same database name in the path). Then production and local will share the same data.

**MONGO_URI is the same but production still has no data?** Check:

1. **MongoDB Atlas → Network Access**  
   Vercel runs from many IPs. If your cluster only allows specific IPs, production requests will be blocked and the API will return 503 or “Database connection error.” Add **0.0.0.0/0** (Allow access from anywhere) for the cluster your `MONGO_URI` uses, or add Vercel’s IP ranges.

2. **Redeploy after changing env vars**  
   Vercel bakes environment variables in at deploy time. After adding or changing `MONGO_URI` (or `JWT_SECRET`), trigger a new deployment (e.g. **Redeploy** in the Vercel dashboard) so the new values are used.

3. **Env scope**  
   In Vercel → Project → Settings → Environment Variables, ensure `MONGO_URI` is enabled for **Production** (and optionally Preview if you use preview URLs).

4. **Vercel function logs**  
   In Vercel → your project → **Deployments** → open the latest deployment → **Functions** → select the API function and open **Logs**. Look for “MongoDB connection error”, “MONGO_URI present: false”, or “authentication failed”. Those confirm a connection problem.

5. **Connection string details**  
   Confirm the value in Vercel matches `.env` exactly (no extra spaces, same database name in the path). If you have more than one Atlas cluster, ensure the URI points to the cluster that has your data.

Vercel will automatically:
- Build the frontend with `npm run build`
- Deploy the backend as serverless functions from the `api/` directory

**What “deploy the backend as serverless functions from the api/ directory” means**  
Vercel turns each file in `api/` into a serverless function. Your `vercel.json` rewrites `/api/*` to `/api/index/*`, so all API requests are handled by **`api/index.js`** (your Express app). That file runs on Vercel’s servers only when a request hits `/api/...`; it connects to MongoDB using `MONGO_URI` from Vercel’s environment. There is no long‑running server—each request can trigger a new “cold” instance that must connect to MongoDB before handling the request.

---

### Troubleshooting: Backend not connecting to MongoDB (was working before)

If the backend used to work in production and now doesn’t, or you see “Database connection error” / 503 / empty data, work through these in order:

1. **Check Vercel function logs**  
   - Vercel dashboard → your project → **Deployments** → latest deployment → **Functions**.  
   - Open the function that serves `/api` (often `api/index.js`).  
   - Open **Logs** and trigger a request (e.g. load the app and log in or open a page that calls the API).  
   - Look for: `MongoDB connection error`, `MONGO_URI present: false`, `ENOTFOUND`, `authentication failed`, or `MongoServerSelectionError`.  
   - That tells you whether the failure is missing env, network, or auth.

2. **Confirm env vars in Vercel**  
   - **Settings** → **Environment Variables**.  
   - Ensure **`MONGO_URI`** and **`JWT_SECRET`** exist and are set for **Production** (and Preview if you use preview URLs).  
   - Value must match your working `.env` (same URI, no leading/trailing spaces).  
   - After any change here, **redeploy** (Deployments → … → Redeploy); Vercel only picks up env vars at deploy time.

3. **MongoDB Atlas → Network Access**  
   - Atlas → your project → **Network Access**.  
   - If there’s no entry for **0.0.0.0/0** (Allow access from anywhere), Vercel’s IPs may be blocked.  
   - Add **0.0.0.0/0** and save (or add [Vercel’s IP ranges](https://vercel.com/guides/ip-addresses) if you restrict IPs).  
   - Wait a minute, then try the app again.

4. **MongoDB Atlas → Database Access**  
   - **Database Access** → user used in `MONGO_URI`.  
   - Ensure that user has **read and write** to the database (e.g. “Atlas admin” or a custom role with `readWrite` on the correct database).  
   - If you changed the password, update `MONGO_URI` in Vercel and redeploy.

5. **Connection string format**  
   - `MONGO_URI` should look like: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`.  
   - **Include the database name** in the path (e.g. `...mongodb.net/handyman?...`) so local and Vercel both use the same DB. If you omit it, the driver uses the default (`test`), which is easy to get out of sync.  
   - Special characters in the password must be [percent-encoded](https://www.w3schools.com/tags/ref_urlencode.asp) (e.g. `@` → `%40`).  
   - In Vercel, the value is often pasted; check for line breaks or truncation.

6. **Atlas cluster state (e.g. M0 free tier)**  
   - **Atlas → Database** → your cluster.  
   - If the cluster is **Paused** (e.g. after inactivity on free tier), resume it.  
   - First request after resume can be slow; retry once.

7. **Quick test from your machine**  
   - From a terminal:  
     `curl -s -o /dev/null -w "%{http_code}" https://<your-vercel-url>/api/customers`  
     (with no auth you may get 401; 401 means the function ran and reached your app; 503 usually means DB or startup failure).  
   - Or open DevTools → Network, trigger a call to `/api/...`, and check status and response body (e.g. “Database connection error”).

After changes to Atlas (Network Access, user, or cluster), wait 1–2 minutes and redeploy or retry; then re-check the same function logs to see the new error (or success).

## Features

- **Customer Management**: Add, edit, and manage customer information
- **Project Tracking**: Track project status, bids, and schedules
- **Material Management**: Keep track of materials used in projects
- **Public Bid Requests**: Customers can submit bid requests without login
- **Admin Dashboard**: Secure admin area for managing all data

## Tech Stack

**Frontend:**
- React 19
- React Router 7
- Vite 7
- Tailwind CSS
- Axios

**Backend:**
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing

## License

MIT
<div align="center">

![QA Leader | CSM | Navy Vet](https://raw.githubusercontent.com/briandchristian/handyman-tracker/main/GithubIcon.svg)

**@briandchristian** • *“2-week releases → <1 hour. Quality at speed.”*

---
  
# Brian D. Christian

**Certified Scrum Master & Senior QA Engineering Leader** | U.S. Navy Veteran  
**Intuit “Bold & Courage” Award Winner** | FDA 510(k) Validation | Automation Pioneer

- Reduced release cycles from **2 weeks to under 1 hour** at Intuit
- Led **FDA 510(k) submission** for FilmArray & Torch at BioFire
- Built **self-healing desktop test frameworks** in C# & custom DSL
- Migrated 30-year code from **Perforce → GitHub** with Property Sheets

**Tech**: C#, Jira, Jenkins, AWS, Splunk, Git, Agile/Scrum, CI/CD

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=briandchristian&show_icons=true&theme=radical&hide_border=true)

*“Quality isn’t a checkpoint — it’s the launchpad.”*

</div>
