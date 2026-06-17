// cPanel Passenger entry point — deployed inside .next/standalone/
//
// When run from .next/standalone/, __dirname is inside .next/ so we walk up
// two levels to the project root. This lets us require the full node_modules
// (installed by npm ci) instead of the minimal standalone subset, and pass
// dir so Next.js finds the build and public files in the right place.
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");

const root = __dirname.includes(".next")
  ? path.join(__dirname, "../..")
  : __dirname;

const next = require(path.join(root, "node_modules", "next"));

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, dir: root });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    await handle(req, res, parse(req.url, true));
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
