const ALLOWED_ORIGINS = new Set([
  "http://localhost:4173",
  "https://twigster536.github.io",
]);

const ALLOWED_TURNSTILE_HOSTS = new Set([
  "localhost",
  "twigster536.github.io",
]);

const MAX_NAME_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 420;

// Maximum 3 submissions in a 60-second window.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Like toggles use an independent, less restrictive rate limit. The key is
// derived from an HMAC, never from the raw browser visitor ID or IP address.
const LIKE_RATE_LIMIT_MAX = 30;
const LIKE_RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_VISITOR_ID_LENGTH = 100;
const MAX_LIKE_STATUS_NOTE_IDS = 100;

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getCorsHeaders(request),
  });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin");

  // Allows direct browser/manual GET requests with no Origin.
  if (!origin && request.method === "GET") {
    return true;
  }

  return origin && ALLOWED_ORIGINS.has(origin);
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createVisitorKey(visitorId, env) {
  if (!env.LIKE_HASH_SECRET) {
    // Do not expose secret/configuration details to public callers.
    console.error("Memory Wall like configuration error.");
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.LIKE_HASH_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(visitorId)
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function checkRateLimit(request, env) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    "unknown";

  // Raw IP is never written to D1.
  const key = await sha256(`memory-wall:${ip}`);

  const now = Math.floor(Date.now() / 1000);

  const existing = await env.DB
    .prepare(`
      SELECT window_start, count
      FROM memory_rate_limits
      WHERE key = ?
    `)
    .bind(key)
    .first();

  if (!existing) {
    await env.DB
      .prepare(`
        INSERT INTO memory_rate_limits
        (key, window_start, count)
        VALUES (?, ?, 1)
      `)
      .bind(key, now)
      .run();

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
    };
  }

  const elapsed = now - existing.window_start;

  if (elapsed >= RATE_LIMIT_WINDOW_SECONDS) {
    await env.DB
      .prepare(`
        UPDATE memory_rate_limits
        SET window_start = ?, count = 1
        WHERE key = ?
      `)
      .bind(now, key)
      .run();

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter: RATE_LIMIT_WINDOW_SECONDS - elapsed,
    };
  }

  await env.DB
    .prepare(`
      UPDATE memory_rate_limits
      SET count = count + 1
      WHERE key = ?
    `)
    .bind(key)
    .run();

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - existing.count - 1,
  };
}

async function checkLikeRateLimit(visitorKey, env) {
  const key = `memory-wall-like:${visitorKey}`;
  const now = Math.floor(Date.now() / 1000);

  const existing = await env.DB
    .prepare(`
      SELECT window_start, count
      FROM memory_rate_limits
      WHERE key = ?
    `)
    .bind(key)
    .first();

  if (!existing) {
    await env.DB
      .prepare(`
        INSERT INTO memory_rate_limits
        (key, window_start, count)
        VALUES (?, ?, 1)
      `)
      .bind(key, now)
      .run();

    return {
      allowed: true,
      remaining: LIKE_RATE_LIMIT_MAX - 1,
    };
  }

  const elapsed = now - existing.window_start;

  if (elapsed >= LIKE_RATE_LIMIT_WINDOW_SECONDS) {
    await env.DB
      .prepare(`
        UPDATE memory_rate_limits
        SET window_start = ?, count = 1
        WHERE key = ?
      `)
      .bind(now, key)
      .run();

    return {
      allowed: true,
      remaining: LIKE_RATE_LIMIT_MAX - 1,
    };
  }

  if (existing.count >= LIKE_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter:
        LIKE_RATE_LIMIT_WINDOW_SECONDS - elapsed,
    };
  }

  await env.DB
    .prepare(`
      UPDATE memory_rate_limits
      SET count = count + 1
      WHERE key = ?
    `)
    .bind(key)
    .run();

  return {
    allowed: true,
    remaining:
      LIKE_RATE_LIMIT_MAX - existing.count - 1,
  };
}

async function verifyTurnstile(token, request, env) {
  if (!token || typeof token !== "string") {
    return {
      success: false,
      reason: "Missing verification token.",
    };
  }

  const ip = request.headers.get("CF-Connecting-IP");

  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET);
  formData.append("response", token);

  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    return {
      success: false,
      reason: "Verification service unavailable.",
    };
  }

  const result = await response.json();

  if (!result.success) {
    return {
      success: false,
      reason: "Human verification failed.",
    };
  }

  if (
    result.hostname &&
    !ALLOWED_TURNSTILE_HOSTS.has(result.hostname)
  ) {
    return {
      success: false,
      reason: "Invalid verification hostname.",
    };
  }

  return {
    success: true,
  };
}

function sanitizePlainText(value) {
  if (typeof value !== "string") {
    return "";
  }

  // Store plain user text only.
  // Rendering must also use textContent in the frontend.
  return value
    .replace(/\u0000/g, "")
    .trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ------------------------------------------
    // CORS PREFLIGHT
    // ------------------------------------------

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(request)) {
        return new Response(null, {
          status: 403,
        });
      }

      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    // Reject calls from unexpected websites.
    if (!isAllowedOrigin(request)) {
      return json(
        request,
        {
          success: false,
          error: "Origin not allowed.",
        },
        403
      );
    }

    try {
      // ------------------------------------------
      // HEALTH CHECK
      // ------------------------------------------

      if (
        url.pathname === "/" &&
        request.method === "GET"
      ) {
        return json(request, {
          success: true,
          service: "Portfolio Memory Wall API",
          version: "1.0",
        });
      }

      // ------------------------------------------
      // GET PUBLIC NOTES
      // ------------------------------------------

      if (
        url.pathname === "/notes" &&
        request.method === "GET"
      ) {
        const result = await env.DB
          .prepare(`
            SELECT
              n.id,
              n.name,
              n.message,
              n.rating,
              COUNT(l.note_id) AS likes,
              n.created_at
            FROM memory_notes AS n
            LEFT JOIN memory_likes AS l
              ON l.note_id = n.id
            WHERE n.status = 'visible'
            GROUP BY
              n.id,
              n.name,
              n.message,
              n.rating,
              n.created_at
            ORDER BY n.created_at DESC
            LIMIT 100
          `)
          .all();

        return json(request, {
          success: true,
          notes: result.results || [],
        });
      }

      // ------------------------------------------
      // GET LIKED NOTE STATUS
      // ------------------------------------------

      if (
        url.pathname === "/likes/status" &&
        request.method === "POST"
      ) {
        const contentType =
          request.headers.get("Content-Type") || "";

        if (
          !contentType
            .toLowerCase()
            .includes("application/json")
        ) {
          return json(
            request,
            {
              success: false,
              error: "Content-Type must be application/json.",
            },
            415
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            request,
            {
              success: false,
              error: "Invalid request body.",
            },
            400
          );
        }

        if (
          typeof body.visitorId !== "string" ||
          !body.visitorId.trim() ||
          body.visitorId.length > MAX_VISITOR_ID_LENGTH
        ) {
          return json(
            request,
            {
              success: false,
              error: "A valid visitorId is required.",
            },
            400
          );
        }

        if (
          !Array.isArray(body.noteIds) ||
          body.noteIds.length > MAX_LIKE_STATUS_NOTE_IDS ||
          body.noteIds.some(
            (id) => !Number.isInteger(id) || id <= 0
          )
        ) {
          return json(
            request,
            {
              success: false,
              error:
                `noteIds must contain at most ${MAX_LIKE_STATUS_NOTE_IDS} positive integers.`,
            },
            400
          );
        }

        const visitorKey = await createVisitorKey(
          body.visitorId,
          env
        );

        if (!visitorKey) {
          return json(
            request,
            {
              success: false,
              error: "The like service is unavailable.",
            },
            503
          );
        }

        const noteIds = [...new Set(body.noteIds)];

        if (noteIds.length === 0) {
          return json(request, {
            success: true,
            likedNoteIds: [],
          });
        }

        const placeholders = noteIds
          .map(() => "?")
          .join(", ");
        const result = await env.DB
          .prepare(`
            SELECT l.note_id
            FROM memory_likes AS l
            INNER JOIN memory_notes AS n
              ON n.id = l.note_id
            WHERE l.visitor_key = ?
              AND n.status = 'visible'
              AND l.note_id IN (${placeholders})
          `)
          .bind(visitorKey, ...noteIds)
          .all();

        return json(request, {
          success: true,
          likedNoteIds: (result.results || []).map(
            (row) => Number(row.note_id)
          ),
        });
      }

      // ------------------------------------------
      // TOGGLE NOTE LIKE
      // ------------------------------------------

      const likeRoute = url.pathname.match(
        /^\/notes\/([^/]+)\/like$/
      );

      if (likeRoute && request.method === "POST") {
        const noteId = Number(likeRoute[1]);

        if (!Number.isSafeInteger(noteId) || noteId <= 0) {
          return json(
            request,
            {
              success: false,
              error: "Note ID must be a positive integer.",
            },
            400
          );
        }

        const contentType =
          request.headers.get("Content-Type") || "";

        if (
          !contentType
            .toLowerCase()
            .includes("application/json")
        ) {
          return json(
            request,
            {
              success: false,
              error: "Content-Type must be application/json.",
            },
            415
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            request,
            {
              success: false,
              error: "Invalid request body.",
            },
            400
          );
        }

        if (
          typeof body.visitorId !== "string" ||
          !body.visitorId.trim() ||
          body.visitorId.length > MAX_VISITOR_ID_LENGTH
        ) {
          return json(
            request,
            {
              success: false,
              error: "A valid visitorId is required.",
            },
            400
          );
        }

        const visitorKey = await createVisitorKey(
          body.visitorId,
          env
        );

        if (!visitorKey) {
          return json(
            request,
            {
              success: false,
              error: "The like service is unavailable.",
            },
            503
          );
        }

        const likeRateLimit = await checkLikeRateLimit(
          visitorKey,
          env
        );

        if (!likeRateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Too many like requests. Please wait before trying again.",
            }),
            {
              status: 429,
              headers: {
                ...getCorsHeaders(request),
                "Retry-After": String(
                  likeRateLimit.retryAfter
                ),
              },
            }
          );
        }

        const note = await env.DB
          .prepare(`
            SELECT id
            FROM memory_notes
            WHERE id = ? AND status = 'visible'
          `)
          .bind(noteId)
          .first();

        if (!note) {
          return json(
            request,
            {
              success: false,
              error: "Note not found.",
            },
            404
          );
        }

        const existingLike = await env.DB
          .prepare(`
            SELECT note_id
            FROM memory_likes
            WHERE note_id = ? AND visitor_key = ?
          `)
          .bind(noteId, visitorKey)
          .first();

        let liked;

        if (existingLike) {
          await env.DB
            .prepare(`
              DELETE FROM memory_likes
              WHERE note_id = ? AND visitor_key = ?
            `)
            .bind(noteId, visitorKey)
            .run();
          liked = false;
        } else {
          await env.DB
            .prepare(`
              INSERT INTO memory_likes
                (note_id, visitor_key)
              VALUES (?, ?)
            `)
            .bind(noteId, visitorKey)
            .run();
          liked = true;
        }

        const count = await env.DB
          .prepare(`
            SELECT COUNT(*) AS likes
            FROM memory_likes
            WHERE note_id = ?
          `)
          .bind(noteId)
          .first();

        return json(request, {
          success: true,
          liked,
          likes: Number(count?.likes || 0),
        });
      }

      // ------------------------------------------
      // SUBMIT NOTE
      // ------------------------------------------

      if (
        url.pathname === "/notes" &&
        request.method === "POST"
      ) {
        const contentType =
          request.headers.get("Content-Type") || "";

        if (
          !contentType
            .toLowerCase()
            .includes("application/json")
        ) {
          return json(
            request,
            {
              success: false,
              error: "Content-Type must be application/json.",
            },
            415
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            request,
            {
              success: false,
              error: "Invalid request body.",
            },
            400
          );
        }

        // --------------------------------------
        // TURNSTILE
        // --------------------------------------

        const verification = await verifyTurnstile(
          body.turnstileToken,
          request,
          env
        );

        if (!verification.success) {
          return json(
            request,
            {
              success: false,
              error: verification.reason,
            },
            403
          );
        }

        // --------------------------------------
        // RATE LIMIT
        // --------------------------------------

        const rateLimit = await checkRateLimit(
          request,
          env
        );

        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Too many submissions. Please wait before trying again.",
            }),
            {
              status: 429,
              headers: {
                ...getCorsHeaders(request),
                "Retry-After": String(
                  rateLimit.retryAfter
                ),
              },
            }
          );
        }

        // --------------------------------------
        // VALIDATION
        // --------------------------------------

        const name = sanitizePlainText(body.name);
        const message = sanitizePlainText(
          body.message
        );

        let rating = null;

        if (
          body.rating !== undefined &&
          body.rating !== null &&
          body.rating !== ""
        ) {
          rating = Number(body.rating);
        }

        if (!name) {
          return json(
            request,
            {
              success: false,
              error: "Name is required.",
            },
            400
          );
        }

        if (
          name.length > MAX_NAME_LENGTH
        ) {
          return json(
            request,
            {
              success: false,
              error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.`,
            },
            400
          );
        }

        if (!message) {
          return json(
            request,
            {
              success: false,
              error: "Message is required.",
            },
            400
          );
        }

        if (
          message.length >
          MAX_MESSAGE_LENGTH
        ) {
          return json(
            request,
            {
              success: false,
              error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
            },
            400
          );
        }

        if (
          rating !== null &&
          (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
          )
        ) {
          return json(
            request,
            {
              success: false,
              error: "Rating must be between 1 and 5.",
            },
            400
          );
        }

        // --------------------------------------
        // DATABASE INSERT
        // --------------------------------------

        // IMPORTANT:
        // Visitor values are parameter-bound.
        // Never concatenate user input into SQL.

        const insert = await env.DB
          .prepare(`
            INSERT INTO memory_notes
              (
                name,
                message,
                rating,
                likes,
                status
              )
            VALUES (?, ?, ?, 0, 'visible')
          `)
          .bind(
            name,
            message,
            rating
          )
          .run();

        const id =
          insert.meta?.last_row_id;

        let note = null;

        if (id) {
          note = await env.DB
            .prepare(`
              SELECT
                id,
                name,
                message,
                rating,
                likes,
                created_at
              FROM memory_notes
              WHERE id = ?
            `)
            .bind(id)
            .first();
        }

        return json(
          request,
          {
            success: true,
            message:
              "Memory added successfully.",
            note,
          },
          201
        );
      }

      // ------------------------------------------
      // UNKNOWN ROUTE
      // ------------------------------------------

      return json(
        request,
        {
          success: false,
          error: "Route not found.",
        },
        404
      );
    } catch (error) {
      console.error(
        "Memory Wall API error:",
        error
      );

      return json(
        request,
        {
          success: false,
          error:
            "The Memory Wall service encountered an error.",
        },
        500
      );
    }
  },
};
