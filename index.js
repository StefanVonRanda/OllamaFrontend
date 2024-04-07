const BASE_PATH = ".";
const PORT = 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    let filePath = BASE_PATH + new URL(req.url).pathname;
		if (filePath === './') filePath = './index.html';
    const file = Bun.file(filePath);
    return new Response(file);
  },
  error() {
    return new Response(null, { status: 404 });
  },
});

console.log(`Server running @ http://localhost:${PORT}`);