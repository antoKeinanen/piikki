# Deploy to Vercel

## Deploy from Git

1. Push this repository to your Git provider.
2. In Vercel, select **Add New**, then **Project**, and import the repository.
3. Use the repository root as the **Root Directory**.
4. Confirm the **Vite** framework preset and **Node.js 24.x**.
5. Select **Deploy**.

The checked-in `vercel.json` sets the install command to `npm ci`, the build command to `npm run build`, and the output directory to `dist`. No environment variables, backend, database service, or Vercel Functions are required.

Vercel hosts the app's HTML, CSS, JavaScript, and SQLite WASM asset. Customer database files remain on the cashier's device. The app requests access to those files through the browser.

## Deploy from the CLI

Run these commands from the repository root:

```sh
npx vercel
```

Follow the prompts to link a Vercel project and create a preview deployment. When that preview is ready for production, run:

```sh
npx vercel --prod
```

The `.vercelignore` file excludes documentation, screenshots, and SQLite databases from CLI uploads. The `.vercel/` project-link directory is ignored by Git. Keep customer files outside the repository as well.

## Verify a deployment

1. Open the deployment's HTTPS URL in the cashier's browser.
2. If the browser lacks required file APIs, confirm that the app shows the compatibility screen and blocks database access.
3. In a browser with the required APIs, select **Try example** and save the sample database to a separate file.
4. Apply a charge, close the app, and reopen that sample file. Confirm that the balance and transaction history were saved.
5. Check **Settings**, including quick-charge editing and **Download backup**.

The production build includes the SQL.js WASM file under `dist/assets`. It needs no external WASM CDN. HTTPS is required for native file access. Hosting on Vercel does not add browser APIs that a device lacks.

Native file pickers need a user gesture. Test file operations by opening the app directly in a browser tab, rather than in an embedded preview.

## Verify locally before deploying

Use Node 24. The `.nvmrc` file selects this version for nvm users.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open the localhost URL printed by the preview command. The preview serves the built `dist` directory. Stop it with Ctrl+C.

The app currently uses only the root URL and does not need a catch-all route rewrite. If client-side routes are added later, configure their fallback without redirecting missing JavaScript or WASM files to HTML.

## Configuration references

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).
- [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
