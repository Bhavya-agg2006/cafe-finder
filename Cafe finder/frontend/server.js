// Cafe Finder server: serves the website and stores visitor reviews.
// Run with:  node server.js     (no npm install needed)

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1"; // only this computer. Use HOST=0.0.0.0 to share on your network
const ROOT = __dirname;
const IMG_FOLDERS = ["img", "images"]; // photos can be in either folder
const IMAGE_EXTS = [".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".avif"];
const REVIEWS_FILE = path.join(ROOT, "reviews.json");

const MAX_CAFE_ID = 18;
const MAX_BODY_BYTES = 10 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

/* ---------- Reviews storage (a simple JSON file) ---------- */
let reviews = [];
try {
  const saved = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf8"));
  if (Array.isArray(saved)) reviews = saved;
} catch (err) {
  reviews = []; // first run: no file yet
}

function saveReviews() {
  const tmp = REVIEWS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(reviews, null, 2));
  fs.renameSync(tmp, REVIEWS_FILE);
}

/* ---------- Helpers ---------- */
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache", // so your edits show up on refresh
    });
    res.end(data);
  });
}

function cleanText(value, maxLength, keepNewlines) {
  const pattern = keepNewlines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return String(value == null ? "" : value).replace(pattern, " ").trim().slice(0, maxLength);
}

// Allow each visitor (IP address) at most 10 new reviews per 10 minutes
const recentPosts = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const times = (recentPosts.get(ip) || []).filter((t) => now - t < windowMs);
  if (times.length >= 10) {
    recentPosts.set(ip, times);
    return true;
  }
  times.push(now);
  recentPosts.set(ip, times);
  return false;
}

function readJsonBody(req, res, callback) {
  let size = 0;
  let tooBig = false;
  const chunks = [];

  req.on("data", (chunk) => {
    if (tooBig) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooBig = true;
      sendJson(res, 413, { error: "That review is too large." });
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (tooBig) return;
    try {
      callback(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (err) {
      sendJson(res, 400, { error: "Invalid request." });
    }
  });
}

/* ---------- Routes ---------- */
const PAGES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/style.css": "style.css",
  "/script.js": "script.js",
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch (err) {
    sendJson(res, 400, { error: "Bad request." });
    return;
  }

  // API: reviews
  if (pathname === "/api/reviews") {
    if (req.method === "GET") {
      sendJson(res, 200, reviews);
      return;
    }

    if (req.method === "POST") {
      const ip = req.socket.remoteAddress || "unknown";
      if (isRateLimited(ip)) {
        sendJson(res, 429, { error: "Too many reviews. Please try again in a few minutes." });
        return;
      }

      readJsonBody(req, res, (body) => {
        const cafeId = Number(body.cafeId);
        const rating = Number(body.rating);
        const name = cleanText(body.name, 40, false);
        const comment = cleanText(body.comment, 500, true);

        if (!Number.isInteger(cafeId) || cafeId < 1 || cafeId > MAX_CAFE_ID) {
          sendJson(res, 400, { error: "Unknown cafe." });
          return;
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          sendJson(res, 400, { error: "Rating must be 1 to 5 stars." });
          return;
        }
        if (!name) {
          sendJson(res, 400, { error: "Please enter your name." });
          return;
        }

        const review = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          cafeId,
          name,
          rating,
          comment,
          date: new Date().toISOString(),
        };

        reviews.unshift(review); // newest first
        try {
          saveReviews();
        } catch (err) {
          reviews.shift();
          sendJson(res, 500, { error: "Could not save your review." });
          return;
        }
        sendJson(res, 201, review);
      });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  // The three website files
  if (PAGES[pathname]) {
    serveFile(res, path.join(ROOT, PAGES[pathname]));
    return;
  }

  // List of the photo files that really exist (the website uses this to match photos to cafes)
  if (pathname === "/api/images") {
    const files = [];
    IMG_FOLDERS.forEach((folder) => {
      try {
        fs.readdirSync(path.join(ROOT, folder)).forEach((file) => {
          if (IMAGE_EXTS.includes(path.extname(file).toLowerCase())) files.push(folder + "/" + file);
        });
      } catch (err) {
        // folder does not exist: nothing to list
      }
    });
    sendJson(res, 200, files);
    return;
  }

  // Cafe photos from the img (or images) folder
  const photoFolder = IMG_FOLDERS.find((folder) => pathname.startsWith("/" + folder + "/"));
  if (photoFolder) {
    let name;
    try {
      name = decodeURIComponent(pathname.slice(photoFolder.length + 2));
    } catch (err) {
      sendJson(res, 400, { error: "Bad request." });
      return;
    }
    const dir = path.join(ROOT, photoFolder);
    const filePath = path.resolve(dir, name);
    if (name !== path.basename(name) || !IMAGE_EXTS.includes(path.extname(name).toLowerCase()) || !filePath.startsWith(dir + path.sep)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    serveFile(res, filePath);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  const photoCount = IMG_FOLDERS.reduce((total, folder) => {
    try {
      return total + fs.readdirSync(path.join(ROOT, folder)).filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase())).length;
    } catch (err) {
      return total;
    }
  }, 0);
  console.log(`Cafe Finder is running at http://localhost:${PORT}`);
  console.log(photoCount + " photo(s) found in the img folder: " + path.join(ROOT, "img"));
  console.log("Press Ctrl + C to stop.");
});