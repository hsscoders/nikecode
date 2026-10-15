/* ============================================================
   Passenger startup file — cPanel "Setup Node.js App"
   Application startup file: passenger.js
   (frontend/Admin runs the ADMIN PANEL on its own app/subdomain)

   Passenger spawns this file and injects PORT. `next start` is not
   used on cPanel. All admin pages live under the /admin/* prefix
   (assetPrefix is also "/admin"), so "/" is redirected to /admin.
   Run `npm run build` so .next/ exists before starting the app.
   ============================================================ */
const http = require("http");
const next = require("next");

const port = parseInt(process.env.PORT, 10) || 3001;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        /* friendly root redirect — the panel lives at /admin */
        if (req.url === "/" || req.url === "") {
          res.writeHead(307, { Location: "/admin" });
          return res.end();
        }
        return handle(req, res);
      })
      .listen(port, () => console.log(`Admin (Next.js) ready on :${port}`));
  })
  .catch((err) => {
    console.error("Admin startup failed:", err);
    process.exit(1);
  });
