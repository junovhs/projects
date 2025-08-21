# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Project Showcase Monorepo

Welcome to the Project Showcase! This is a monorepo designed to host and display various web experiments, utilities, and mini-applications in a clean, unified, and mobile-friendly interface. The main application is a "shell" built with Vite and React, which acts as a navigator and host for the individual projects.

## Core Technologies

- **Frontend Shell**: [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- **Routing**: [React Router](https://reactrouter.com/) for navigating between projects.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for smooth page transitions.
- **Backend**: [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node.js runtime) for any project requiring backend logic.
- **Deployment**: Hosted and deployed on [Vercel](https://vercel.com).

## Project Structure

The repository is structured to keep the shell application separate from the individual projects it hosts.

```
projects/
├── api/                  # Vercel Serverless Functions (Backend logic)
│   └── asset-sucker/     # Backend endpoints for the Asset Sucker project
├── pages/                # Contains all individual, self-contained projects
│   └── cat.Utilities/
│       └── asset-sucker/
│           └── index.html # The static frontend for Asset Sucker
├── public/               # Static assets for the main shell app
├── scripts/              # Build scripts (e.g., generating project index)
├── src/                  # Source code for the main React shell application
│   ├── ui.jsx            # The main App component with routing and layout
│   └── main.jsx          # Entry point for the React app
├── package.json          # Dependencies for the shell AND serverless functions
├── vercel.json           # Vercel deployment configuration (handles SPA routing)
└── vite.config.js        # Vite configuration
```

## How It Works

1. **Project Indexing**: A script (`scripts/build.cjs`) scans the `pages/` directory and generates a `projects.json` file. This file acts as a manifest of all available projects, which the sidebar navigation uses.
2. **Shell Application**: The main application in `src/` is a Single-Page Application (SPA). It reads `projects.json` to build the sidebar.
3. **Navigation & Display**: When a user clicks a project link, React Router updates the URL. The `ProjectPage` component then renders an `<iframe>` whose `src` attribute points to the corresponding `index.html` file within the `pages/` directory (e.g., `/pages/cat.Utilities/asset-sucker/index.html`).
4. **Backend Logic**: If a project needs a backend (like Asset Sucker), its frontend `fetch` requests are directed to endpoints in the `/api/` directory. Vercel automatically deploys these as serverless functions.
5. **SPA Routing on Vercel**: The `vercel.json` file contains a rewrite rule that directs all non-asset/API requests back to the root `index.html`. This allows direct navigation to project URLs (e.g., `.../asset-sucker`) to work correctly.

## Local Development

The project requires running both the Vite frontend server and a local Vercel environment for the serverless functions.

**Prerequisites:**
- Node.js (v18+)
- Vercel CLI (`npm install -g vercel`)

**Running the App:**

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Development Servers:**
   The provided `dev.sh` script handles running both servers concurrently.
   ```bash
   ./scripts/dev.sh
   ```
   
   Alternatively, you can run them in separate terminal windows:
   ```bash
   # Terminal 1: Start Vercel's dev server for serverless functions
   vercel dev

   # Terminal 2: Start the Vite dev server for the frontend shell
   npm run dev
   ```
   
   The application will be available at the URL provided by the Vite server (usually `http://localhost:5173`).

## Adding a New Project

1. Create a new folder inside `projects/pages/` under an appropriate category (e.g., `projects/pages/cat.NewCategory/my-new-project/`).
2. Add an `index.html` file as the entry point for your project.
3. (Optional) Add a `README.md` or `writeup.html` in the project folder to be displayed in the "About" panel.
4. Restart the development server to have your new project appear in the sidebar.