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

3. Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   ```

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
   - `MONGO_URI`
   - `JWT_SECRET`
4. Deploy!

Vercel will automatically:
- Build the frontend with `npm run build`
- Deploy the backend as serverless functions from the `api/` directory

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
