# Asset Sucker

Asset Sucker is a utility that scrapes a given URL for visual assets (images, SVGs, GIFs, icons, and CSS background images) and allows the user to download them as a ZIP archive.

## Integration within the Showcase

This project is not a standalone application but is integrated into the main "Project Showcase" shell. Its architecture is split into two distinct parts: a static frontend and a set of serverless backend functions.

- **Frontend**: A self-contained, vanilla JavaScript application located at `index.html` in this directory. The main showcase loads this file into an `<iframe>`.
- **Backend**: A collection of Vercel Serverless Functions located in `projects/api/asset-sucker/` that handle the heavy lifting of scraping and file processing.

This decoupled approach allows the tool to have a complex backend while remaining a simple, static project that the showcase can easily display.

## Technology Breakdown

### Frontend (`index.html`)

- **Technology**: Vanilla JavaScript, HTML, and CSS. It contains no frameworks or build steps, making it lightweight and portable.
- **Functionality**:
  - Renders the entire user interface.
  - Manages application state (loading, assets, filters, etc.).
  - Makes `fetch` requests to its backend endpoints to perform actions.
  - Uses the `/api/asset-sucker/proxy` endpoint to display images from third-party domains, avoiding browser CORS (Cross-Origin Resource Sharing) errors.

### Backend (Serverless Functions)

The backend logic resides in `projects/api/asset-sucker/` and relies on the following key technologies:

- **Runtime**: Vercel Serverless Functions (Node.js).
- **Dependencies**:
  - `cheerio`: A fast, server-side implementation of jQuery used to parse and traverse the HTML of the target website.
  - `jszip`: A library for creating and managing `.zip` files in Node.js.

#### Endpoints:

1. **`/api/asset-sucker/scrape.js`**
   - **Purpose**: To find all asset URLs on a page.
   - **How it works**: It receives a URL in a POST request. It then fetches the HTML of that URL, spoofing common browser headers to bypass basic bot detection. It uses `cheerio` to parse the HTML and linked CSS files, extracting URLs from `<img>` tags, `srcset` attributes, `<link rel="icon">`, and `background-image` properties. It returns a JSON array of found asset URLs.

2. **`/api/asset-sucker/download.js`**
   - **Purpose**: To scrape, download, and zip all assets.
   - **How it works**: It performs the same scraping logic as the `scrape` endpoint. Then, it fetches each discovered asset URL in parallel, collecting the binary data. Using `jszip`, it packages all the downloaded files into a single ZIP archive, which it streams back to the user's browser as a file download.

3. **`/api/asset-sucker/proxy.js`**
   - **Purpose**: To act as a CORS proxy for displaying images in the UI.
   - **How it works**: The frontend's `<img>` tags point to this endpoint with a target URL as a query parameter (e.g., `.../proxy?url=https://example.com/image.png`). This function fetches the remote image on the server-side and then streams it back to the browser. Since the request to the third-party domain happens from the server, it is not subject to browser CORS restrictions.