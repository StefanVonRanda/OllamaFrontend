const BASE_PATH = ".";
const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/") return new Response(Bun.file(`${BASE_PATH}/index.html`));
    else { return new Response(Bun.file(`${BASE_PATH}${path}`)); }
  },
});

console.log(`Listening on ${server.url}`);