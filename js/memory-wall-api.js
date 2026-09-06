/*
 * Shared Memory Wall API client.
 * This file intentionally contains only public configuration. Turnstile's
 * secret key and all D1 credentials remain in the Cloudflare Worker.
 */
window.MemoryWallApi = (() => {
  const MEMORY_API = "https://portfolio-memory-wall-api.dishnuunnikrishnan.workers.dev";
  const TURNSTILE_SITE_KEY = "0x4AAAAAAEneErNDzz3YNpAU";
  const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  class MemoryWallApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = "MemoryWallApiError";
      this.status = status;
    }
  }

  async function request(path, options = {}) {
    let response;

    try {
      response = await fetch(`${MEMORY_API}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });
    } catch {
      throw new MemoryWallApiError("Shared Memory Wall connection unavailable.");
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new MemoryWallApiError(
        typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : "Memory Wall service unavailable.",
        response.status,
      );
    }

    return payload;
  }

  async function getNotes() {
    const payload = await request("/notes");

    if (!Array.isArray(payload.notes)) {
      throw new MemoryWallApiError("Memory Wall returned an invalid note list.");
    }

    return payload.notes;
  }

  function submitNote(note) {
    return request("/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
  }

  function toggleLike(noteId, visitorId) {
    return request(`/notes/${encodeURIComponent(noteId)}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });
  }

  async function getLikeStatus(visitorId, noteIds) {
    const payload = await request("/likes/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, noteIds }),
    });

    if (!Array.isArray(payload.likedNoteIds)) {
      throw new MemoryWallApiError("Memory Wall returned an invalid like status.");
    }

    return payload.likedNoteIds;
  }

  return Object.freeze({
    config: Object.freeze({
      memoryApi: MEMORY_API,
      turnstileSiteKey: TURNSTILE_SITE_KEY,
      turnstileScript: TURNSTILE_SCRIPT,
    }),
    getNotes,
    submitNote,
    toggleLike,
    getLikeStatus,
    Error: MemoryWallApiError,
  });
})();
