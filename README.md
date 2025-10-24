
# Project Showcase

This is a monorepo designed to host and display various web experiments, utilities, and mini-applications in a clean, unified, and mobile-friendly interface. The main application is a "shell" built with Vite and React, which acts as a navigator and host for the individual projects.

## Core Technologies

- **Frontend Shell**: [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Backend**: [Vercel Serverless Functions](https://vercel.com/docs/functions)
- **Deployment**: [Vercel](https://vercel.com)

## Project Structure

```
.
├── api/                  # Vercel Serverless Functions (Backend)
│   └── _lib/             # Shared helpers for API routes
├── pages/                # Contains all individual, self-contained projects
│   ├── Utilities/
│   │   └── asset-sucker/
│   │       └── index.html
│   └── THESE_ARE_CATEGORIES.txt # Note: Top-level folders here are categories
├── public/               # Static assets for the main shell app
├── scripts/              # Build scripts (e.g., generating project index)
└── src/                  # Source code for the main React shell application
    ├── components/       # Reusable React components
    ├── hooks/            # Reusable React hooks
    ├── App.jsx           # Main App component with routing and layout
    └── main.jsx          # Entry point for the React app
```

## How It Works

1.  **Project Indexing**: A script (`scripts/build.cjs`) scans the `pages/` directory and generates a `public/projects.json` file. This manifest is used by the frontend to build the sidebar navigation.
2.  **Shell Application**: The main React SPA reads `projects.json` to build the sidebar. When a project is selected, React Router updates the URL.
3.  **Display**: The `ProjectPage` component renders a sandboxed `<iframe>` pointing to the corresponding project's `index.html`.
4.  **Backend**: API endpoints in the `/api/` directory are deployed by Vercel as serverless functions. During local development, these are proxied to a live deployment for convenience.

## Local Development

**Prerequisites:**
- Node.js (v18+)
- npm or equivalent package manager

**Running the App:**

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Generate Project Index:**
    Before starting the dev server, you must generate the `projects.json` file.
    ```bash
    node scripts/build.cjs
    ```

3.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
   The application will be available at `http://localhost:5173`.

## Adding a New Project

1.  Create a new category folder inside `pages/` if one doesn't already exist (e.g., `pages/Experiments/`).
2.  Create your project folder inside the category (e.g., `pages/Experiments/my-new-project/`).
3.  Add an `index.html` file as the entry point for your project.
4.  (Optional) Add a `README.md` or `writeup.html` in the project folder to be displayed in the "About" panel.
5.  Re-run `node scripts/build.cjs` to update the project index. The dev server should automatically pick up the change.
```

```
# projects/pages/THESE_ARE_CATEGORIES.txt
The top-level folders in this 'pages' directory are treated as categories for the project showcase sidebar.

For example:
/pages/Utilities/my-utility  ->  Category: Utilities, Project: my-utility
/pages/Experiments/my-test   ->  Category: Experiments, Project: my-test

The build script will scan these folders and generate the necessary `projects.json` file for the frontend.


```html
<!-- projects/pages/Utilities/asset-sucker/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asset Sucker Placeholder</title>
    <style>
        body { font-family: system-ui, sans-serif; display: grid; place-content: center; text-align: center; min-height: 100vh; margin: 0; background-color: #111; color: #eee; }
        h1 { font-weight: 300; }
    </style>
</head>
<body>
    <div>
        <h1>Asset Sucker Project</h1>
        <p>This is a placeholder for the Asset Sucker project frontend.</p>
    </div>
</body>
</html>
```