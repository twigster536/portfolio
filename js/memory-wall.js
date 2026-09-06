/* Memory Wall UI: safe shared-note rendering, filtering, and Turnstile state. */
window.MemoryWall = (() => {
  const api = window.MemoryWallApi;
  const VISITOR_ID_STORAGE_KEY = "portfolio_memory_wall_visitor_id";
  const state = {
    notes: [],
    likedNoteIds: new Set(),
    pendingLikeIds: new Set(),
    loading: false,
    loadError: null,
  };
  let ui;
  let visitorId;
  let turnstileToken = null;
  let turnstileWidgetId = null;
  let turnstileLoadPromise;
  let turnstileState = "idle";

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function isTurnstileConfigured() {
    const key = api?.config?.turnstileSiteKey;
    return typeof key === "string" && /^0x[A-Za-z0-9_-]{20,}$/.test(key);
  }

  function getVisitorId() {
    if (visitorId) return visitorId;

    try {
      visitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
      }
    } catch (error) {
      visitorId = crypto.randomUUID();
      console.warn("[MemoryWall] Visitor ID persistence unavailable", error);
    }

    return visitorId;
  }

  function normaliseReview(value) {
    const name = String(value.name || "").trim().replace(/\s+/g, " ");
    const message = String(value.message || "").trim().replace(/\s+/g, " ");
    const rawRating = value.rating;
    const rating = rawRating === "" || rawRating === null || rawRating === undefined || Number(rawRating) === 0
      ? null
      : Number(rawRating);

    if (!name || name.length > 60) {
      throw new Error("Enter a visitor name of up to 60 characters.");
    }

    if (!message || message.length > 420) {
      throw new Error("Enter a note of up to 420 characters.");
    }

    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      throw new Error("Choose a rating from 1 to 5, or leave it unselected.");
    }

    return { name, message, rating };
  }

  function normaliseNote(note) {
    const numericRating = Number(note?.rating);
    const numericLikes = Number(note?.likes);
    return {
      id: String(note?.id ?? ""),
      name: String(note?.name ?? "Visitor"),
      message: String(note?.message ?? ""),
      rating: Number.isInteger(numericRating) && numericRating >= 1 && numericRating <= 5 ? numericRating : null,
      likes: Number.isFinite(numericLikes) && numericLikes >= 0 ? numericLikes : 0,
      createdAt: note?.created_at ?? "",
    };
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function stars(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function setStatus(message, isError = false) {
    if (!ui) return;
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", isError);
  }

  function setVerificationStatus(message, isError = false, showRetry = false) {
    if (!ui) return;
    ui.turnstileStatus.textContent = message;
    ui.turnstileStatus.classList.toggle("is-error", isError);
    ui.turnstileRetry.hidden = !showRetry;
  }

  function userFriendlyError(error) {
    switch (Number(error?.status)) {
      case 400:
        return "INVALID NOTE DETAILS. CHECK YOUR ENTRY AND TRY AGAIN.";
      case 403:
        return "HUMAN VERIFICATION FAILED. PLEASE VERIFY AGAIN.";
      case 429:
        return "TOO MANY SUBMISSIONS. PLEASE WAIT BEFORE TRYING AGAIN.";
      case 500:
      case 502:
      case 503:
      case 504:
        return "MEMORY WALL SERVICE UNAVAILABLE. PLEASE TRY AGAIN LATER.";
      default:
        return "MEMORY WALL CONNECTION UNAVAILABLE.";
    }
  }

  function setRating(rating) {
    ui.rating = rating;
    ui.starButtons.forEach((button, index) => {
      const selected = index < rating;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function visibleNotes() {
    const searchTerm = ui.search.value.trim().toLocaleLowerCase();
    const selectedRating = Number(ui.ratingFilter.value);
    const notes = state.notes.filter((note) => {
      const matchesSearch = !searchTerm || `${note.name} ${note.message}`.toLocaleLowerCase().includes(searchTerm);
      return matchesSearch && (!selectedRating || note.rating === selectedRating);
    });

    return notes.slice().sort((first, second) => {
      const firstTime = new Date(first.createdAt).getTime() || 0;
      const secondTime = new Date(second.createdAt).getTime() || 0;
      if (ui.sort.value === "oldest") return firstTime - secondTime;
      if (ui.sort.value === "rating") return (second.rating || 0) - (first.rating || 0) || secondTime - firstTime;
      return secondTime - firstTime;
    });
  }

  function renderMessage(message, className, retry) {
    ui.cards.replaceChildren();
    const wrapper = create("div", className || "memory-empty");
    wrapper.append(create("p", "", message));
    if (retry) {
      const button = create("button", "memory-retry", "RETRY");
      button.type = "button";
      button.addEventListener("click", refresh);
      wrapper.append(button);
    }
    ui.cards.append(wrapper);
  }

  async function toggleLike(noteId) {
    if (state.pendingLikeIds.has(noteId)) return;

    const note = state.notes.find((item) => item.id === noteId);
    if (!note) return;

    state.pendingLikeIds.add(noteId);
    renderNotes();

    try {
      const result = await api.toggleLike(noteId, getVisitorId());
      const likes = Number(result.likes);

      if (typeof result.liked !== "boolean" || !Number.isFinite(likes) || likes < 0) {
        throw new Error("Memory Wall returned an invalid like response.");
      }

      note.likes = likes;
      if (result.liked) state.likedNoteIds.add(noteId);
      else state.likedNoteIds.delete(noteId);
      setStatus("LIKE STATE SYNCHRONIZED");
    } catch (error) {
      console.error("[MemoryWall] Like synchronization failed", error);
      setStatus("LIKE SYNC FAILED \u2014 RETRY", true);
    } finally {
      state.pendingLikeIds.delete(noteId);
      renderNotes();
    }
  }

  function renderNotes() {
    if (state.loading) {
      ui.count.textContent = "—";
      ui.resultCount.textContent = "SYNCING SHARED WALL...";
      renderMessage("SYNCING SHARED WALL...", "memory-empty memory-loading");
      return;
    }

    if (state.loadError) {
      ui.count.textContent = "—";
      ui.resultCount.textContent = "SHARED WALL OFFLINE";
      renderMessage("MEMORY WALL CONNECTION UNAVAILABLE", "memory-empty memory-load-error", true);
      return;
    }

    const notes = visibleNotes();
    ui.cards.replaceChildren();
    if (!notes.length) {
      const isFiltered = state.notes.length > 0;
      renderMessage(
        isFiltered ? "No matching visitor memories yet." : "No visitor memories yet. Be the first to leave a mark.",
        "memory-empty",
      );
    } else {
      notes.forEach((note, index) => {
        const card = create("article", `memory-card memory-tint-${index % 5}`);
        const heading = create("div", "memory-card-heading");
        const name = create("h3", "", note.name);
        heading.append(name);

        if (note.rating !== null) {
          const rating = create("span", "memory-card-rating", stars(note.rating));
          rating.setAttribute("aria-label", `${note.rating} out of 5 stars`);
          heading.append(rating);
        }

        const metadata = create("div", "memory-card-meta");
        metadata.append(create("time", "", formatDate(note.createdAt)));
        if (Number.isFinite(note.likes)) {
          const liked = state.likedNoteIds.has(note.id);
          const pending = state.pendingLikeIds.has(note.id);
          const likeButton = create("button", "memory-card-like");
          likeButton.type = "button";
          likeButton.disabled = pending;
          likeButton.classList.toggle("is-liked", liked);
          likeButton.classList.toggle("is-pending", pending);
          likeButton.setAttribute("aria-pressed", String(liked));
          likeButton.setAttribute("aria-label", `${liked ? "Unlike" : "Like"} this note`);
          const heart = create("span", "memory-like-heart", liked ? "\u2665" : "\u2661");
          heart.setAttribute("aria-hidden", "true");
          likeButton.append(heart, create("span", "memory-like-count", String(note.likes)));
          likeButton.addEventListener("click", () => toggleLike(note.id));
          metadata.append(likeButton);
        }

        card.append(heading, metadata, create("p", "", note.message));
        ui.cards.append(card);
      });
    }

    ui.count.textContent = String(state.notes.length);
    ui.resultCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  }

  async function refresh() {
    state.loading = true;
    state.loadError = null;
    renderNotes();
    setStatus("SYNCING SHARED WALL...");

    try {
      state.notes = (await api.getNotes()).map(normaliseNote);
      state.likedNoteIds.clear();
      state.loading = false;
      renderNotes();
      setStatus("SHARED MEMORY NETWORK ONLINE • SECURED BY CLOUDFLARE");
      const noteIds = state.notes
        .map((note) => Number(note.id))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
        .slice(0, 100);

      if (noteIds.length) {
        try {
          const likedNoteIds = await api.getLikeStatus(getVisitorId(), noteIds);
          state.likedNoteIds = new Set(likedNoteIds.map(String));
          renderNotes();
        } catch (error) {
          console.warn("[MemoryWall] Like state restoration failed", error);
        }
      }

      return true;
    } catch (error) {
      state.loading = false;
      state.loadError = error;
      renderNotes();
      setStatus(userFriendlyError(error), true);
      return false;
    }
  }

  function destroyTurnstile() {
    turnstileToken = null;
    if (turnstileWidgetId !== null && window.turnstile?.remove) {
      window.turnstile.remove(turnstileWidgetId);
    }
    turnstileWidgetId = null;
    turnstileState = "idle";
  }

  function loadTurnstile({ forceReload = false } = {}) {
    if (window.turnstile) return Promise.resolve(window.turnstile);

    const existing = document.querySelector("script[data-memory-wall-turnstile]");
    if (forceReload && existing?.dataset.memoryWallTurnstile !== "loading") {
      existing.remove();
      turnstileLoadPromise = undefined;
    }

    if (turnstileLoadPromise) return turnstileLoadPromise;

    turnstileLoadPromise = new Promise((resolve, reject) => {
      const currentScript = document.querySelector("script[data-memory-wall-turnstile]");
      const script = currentScript || document.createElement("script");
      const fail = (error) => {
        script.dataset.memoryWallTurnstile = "failed";
        turnstileLoadPromise = undefined;
        console.error("[MemoryWall] Turnstile initialization failed", error);
        reject(error);
      };
      const finish = () => {
        if (!window.turnstile) {
          fail(new Error("Turnstile failed to initialize."));
          return;
        }
        script.dataset.memoryWallTurnstile = "loaded";
        console.info("[MemoryWall] Turnstile script loaded");
        resolve(window.turnstile);
      };

      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => fail(new Error("Turnstile could not be loaded.")), { once: true });

      if (!currentScript) {
        script.src = api.config.turnstileScript;
        script.async = true;
        script.dataset.memoryWallTurnstile = "loading";
        document.head.append(script);
      } else if (script.dataset.memoryWallTurnstile === "loaded") {
        fail(new Error("Turnstile loaded without an available API."));
      }
    });

    return turnstileLoadPromise;
  }

  async function mountTurnstile({ forceReload = false } = {}) {
    if (!isTurnstileConfigured()) {
      turnstileState = "error";
      setVerificationStatus("TURNSTILE CONFIGURATION INVALID", true);
      return;
    }

    if (turnstileWidgetId !== null || turnstileState === "loading") return;
    if (!ui?.turnstileMount?.isConnected) {
      console.error("[MemoryWall] Turnstile initialization failed", new Error("Turnstile container was not mounted."));
      return;
    }

    turnstileState = "loading";
    setVerificationStatus("INITIALIZING HUMAN VERIFICATION...");

    try {
      const turnstile = await loadTurnstile({ forceReload });
      if (!ui?.turnstileMount.isConnected) return;

      console.info("[MemoryWall] Turnstile render start");
      turnstileWidgetId = turnstile.render(ui.turnstileMount, {
        sitekey: api.config.turnstileSiteKey,
        theme: "dark",
        size: "compact",
        retry: "never",
        callback(token) {
          turnstileToken = token;
          turnstileState = "verified";
          setVerificationStatus("HUMAN VERIFIED");
          console.info("[MemoryWall] Human verification complete");
        },
        "expired-callback"() {
          turnstileToken = null;
          turnstileState = "expired";
          setVerificationStatus("VERIFICATION EXPIRED. PLEASE VERIFY AGAIN.", true);
        },
        "error-callback"(errorCode) {
          turnstileToken = null;
          turnstileState = "error";
          console.error("[MemoryWall] Turnstile verification error", errorCode);
          const isConfigurationError = String(errorCode) === "400020" || String(errorCode).startsWith("110");
          setVerificationStatus(
            isConfigurationError ? "TURNSTILE CONFIGURATION INVALID" : "VERIFICATION SERVICE UNAVAILABLE",
            true,
            !isConfigurationError,
          );
        },
      });
      turnstileState = "verifying";
      setVerificationStatus("VERIFY BEFORE LEAVING YOUR MARK");
      console.info("[MemoryWall] Turnstile widget rendered");
    } catch (error) {
      turnstileState = "error";
      console.error("[MemoryWall] Turnstile initialization failed", error);
      setVerificationStatus("VERIFICATION SERVICE UNAVAILABLE", true, true);
    }
  }

  function resetTurnstile(message) {
    turnstileToken = null;
    if (turnstileWidgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(turnstileWidgetId);
    }
    turnstileState = "verifying";
    setVerificationStatus(message || "VERIFY BEFORE LEAVING YOUR MARK");
  }

  function retryTurnstile() {
    if (!ui || turnstileState === "loading") return;
    destroyTurnstile();
    ui.turnstileMount.replaceChildren();
    mountTurnstile({ forceReload: !window.turnstile });
  }

  async function submitReview(event) {
    event.preventDefault();
    let review;

    try {
      review = normaliseReview({ name: ui.name.value, message: ui.message.value, rating: ui.rating });
    } catch (error) {
      setStatus(error.message, true);
      return;
    }

    if (!turnstileToken) {
      setStatus("COMPLETE HUMAN VERIFICATION BEFORE LEAVING YOUR MARK.", true);
      return;
    }

    ui.submit.disabled = true;
    ui.submit.textContent = "TRANSMITTING...";
    setStatus("TRANSMITTING MEMORY TO THE SHARED WALL...");

    try {
      await api.submitNote({ ...review, turnstileToken });
      ui.form.reset();
      ui.counter.textContent = "0/420";
      setRating(0);
      resetTurnstile("VERIFY BEFORE LEAVING YOUR NEXT MARK");
      await refresh();
      setStatus("MEMORY ADDED TO WALL");
    } catch (error) {
      resetTurnstile("VERIFICATION RESET. PLEASE VERIFY AGAIN.");
      setStatus(userFriendlyError(error), true);
    } finally {
      ui.submit.disabled = false;
      ui.submit.textContent = "LEAVE YOUR MARK";
    }
  }

  function createLabel(text, input) {
    const label = create("label", "memory-form-label", text);
    label.htmlFor = input.id;
    return label;
  }

  function buildWall() {
    const shell = create("section", "memory-wall");
    shell.setAttribute("aria-labelledby", "modalTitle");
    const hero = create("header", "memory-hero");
    const heroCopy = create("div", "memory-hero-copy");
    const heroEyebrow = create("p", "memory-eyebrow", "VISITOR MEMORIES");
    const heroTitle = create("h2", "", "Leave a mark on Dishnu’s portfolio");
    heroTitle.id = "modalTitle";
    heroCopy.append(heroEyebrow, heroTitle, create("p", "", "A shared wall for visitors, clients, and curious explorers. Add a thought, note, or rating to become part of the portfolio experience."));
    const countPanel = create("div", "memory-count-panel");
    const count = create("strong", "", "—");
    countPanel.append(count, create("span", "", "Notes on the wall"));
    hero.append(heroCopy, countPanel);

    const body = create("div", "memory-wall-body");
    const form = create("form", "memory-form");
    form.append(create("h3", "", "Add your note"), create("p", "", "Leave a small piece of your visit inside this interactive portfolio."));

    const name = document.createElement("input");
    name.id = "memoryName";
    name.type = "text";
    name.maxLength = 60;
    name.autocomplete = "name";
    name.placeholder = "Your name";
    name.required = true;

    const message = document.createElement("textarea");
    message.id = "memoryMessage";
    message.maxLength = 420;
    message.placeholder = "Write something thoughtful…";
    message.required = true;
    const counter = create("span", "memory-counter", "0/420");

    const ratingLegend = create("p", "memory-form-label", "Experience rating");
    const starsPanel = create("div", "memory-rating-picker");
    starsPanel.setAttribute("role", "group");
    starsPanel.setAttribute("aria-label", "Experience rating");
    const starButtons = [];
    for (let rating = 1; rating <= 5; rating += 1) {
      const star = create("button", "memory-rating-star", "★");
      star.type = "button";
      star.setAttribute("aria-label", `Set rating to ${rating} out of 5`);
      star.addEventListener("click", () => setRating(rating));
      starButtons.push(star);
      starsPanel.append(star);
    }

    const verificationLabel = create("p", "memory-form-label", "Human verification");
    const turnstileArea = create("div", "memory-turnstile");
    const turnstileMount = create("div", "memory-turnstile-mount");
    turnstileMount.id = "memory-turnstile";
    const turnstileStatus = create("p", "memory-turnstile-status", "INITIALIZING VERIFICATION...");
    const turnstileRetry = create("button", "memory-turnstile-retry", "RETRY");
    turnstileRetry.type = "button";
    turnstileRetry.hidden = true;
    turnstileRetry.addEventListener("click", retryTurnstile);
    turnstileArea.append(turnstileMount, turnstileStatus, turnstileRetry);

    const submit = create("button", "memory-submit", "LEAVE YOUR MARK");
    submit.type = "submit";
    form.append(
      createLabel("Your name", name),
      name,
      createLabel("Your message", message),
      message,
      counter,
      ratingLegend,
      starsPanel,
      verificationLabel,
      turnstileArea,
      submit,
    );

    const content = create("section", "memory-notes");
    const toolbar = create("div", "memory-toolbar");
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search notes…";
    search.setAttribute("aria-label", "Search visitor notes");
    const sort = document.createElement("select");
    sort.setAttribute("aria-label", "Sort notes");
    [["newest", "Newest first"], ["oldest", "Oldest first"], ["rating", "Highest rating"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sort.append(option);
    });
    const ratingFilter = document.createElement("select");
    ratingFilter.setAttribute("aria-label", "Filter by rating");
    [["0", "All ratings"], ["5", "5 stars"], ["4", "4 stars"], ["3", "3 stars"], ["2", "2 stars"], ["1", "1 star"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      ratingFilter.append(option);
    });
    toolbar.append(search, sort, ratingFilter);
    const resultsMeta = create("p", "memory-results-meta", "SYNCING SHARED WALL...");
    const cards = create("div", "memory-cards");
    content.append(toolbar, resultsMeta, cards);
    body.append(form, content);
    const status = create("p", "memory-status");
    status.setAttribute("role", "status");
    shell.append(hero, body, status);

    message.addEventListener("input", () => { counter.textContent = `${message.value.length}/420`; });
    search.addEventListener("input", renderNotes);
    sort.addEventListener("change", renderNotes);
    ratingFilter.addEventListener("change", renderNotes);
    form.addEventListener("submit", submitReview);

    return {
      shell,
      form,
      name,
      message,
      counter,
      rating: 0,
      starButtons,
      submit,
      search,
      sort,
      ratingFilter,
      cards,
      count,
      resultCount: resultsMeta,
      status,
      turnstileMount,
      turnstileStatus,
      turnstileRetry,
    };
  }

  function open() {
    const modal = document.getElementById("detailsModal");
    const windowElement = document.getElementById("detailsWindow");
    const content = document.getElementById("modalContent");
    const label = document.getElementById("modalLabel");
    const close = document.getElementById("modalClose");
    const panelBar = windowElement.querySelector(".panel-bar");
    if (!panelBar.contains(close)) panelBar.append(close);

    destroyTurnstile();
    ui = buildWall();
    content.replaceChildren(ui.shell);
    windowElement.classList.remove("is-resume-viewer", "is-dark-view", "is-light-view");
    windowElement.classList.add("is-memory-wall");
    label.textContent = "MEMORY WALL";
    close.setAttribute("aria-label", "Close Memory Wall");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    setRating(0);
    refresh();
    mountTurnstile();
  }

  return { open, refresh };
})();
