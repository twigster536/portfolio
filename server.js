/* Framework-free local review service.
   Run this file to serve the portfolio and persist shared Memory Wall notes. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const dataFile = path.join(root, "assets", "data", "memory-wall.json");
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readReviews() {
  try {
    const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeReviews(reviews) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(reviews, null, 2) + "\n", "utf8");
}

function validateReview(value) {
  const name = String(value.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const message = String(value.message || "").trim().replace(/\s+/g, " ").slice(0, 420);
  const rating = Number(value.rating);
  if (!name || !message || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name, message, rating, createdAt: new Date().toISOString() };
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15000) reject(new Error("Request too large."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function serveFile(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const target = path.resolve(root, "." + requested);
  if (!target.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const content = await fs.readFile(target);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/reviews" && request.method === "GET") {
    json(response, 200, { reviews: await readReviews() });
    return;
  }
  if (url.pathname === "/api/reviews" && request.method === "POST") {
    try {
      const review = validateReview(JSON.parse(await requestBody(request)));
      if (!review) {
        json(response, 400, { error: "Name, message, and a one-to-five star rating are required." });
        return;
      }
      const reviews = await readReviews();
      reviews.unshift(review);
      await writeReviews(reviews);
      json(response, 201, review);
    } catch {
      json(response, 400, { error: "Unable to save this review." });
    }
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    await serveFile(request, response, decodeURIComponent(url.pathname));
    return;
  }
  response.writeHead(405, { Allow: "GET, HEAD, POST" });
  response.end("Method not allowed");
});

server.listen(port, () => console.log("Portfolio review service: http://localhost:" + port));
