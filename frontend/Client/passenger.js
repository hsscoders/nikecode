/* ============================================================
   Passenger startup file — cPanel "Setup Node.js App"
   Application startup file: passenger.js
   (frontend/Client runs the PUBLIC website on the main domain)

   Passenger spawns this file and injects PORT. `next start` is not
   used on cPanel — the Next request handler runs inside this HTTP
   server instead. Run `npm run build` (via the deploy workflow or
   manually) so .next/ exists before starting the app.
   ============================================================ */
const http = require("http");
const next = require("next");

const port = parseInt(process.env.PORT, 10) || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => console.log(`Client (Next.js) ready on :${port}`));
  })
  .catch((err) => {
    console.error("Client startup failed:", err);
    process.exit(1);
  });
