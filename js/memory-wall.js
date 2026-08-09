/* Memory Wall: visitor notes, ratings, filtering, and persistent review loading. */
window.MemoryWall = (() => {
  const apiPath = "api/reviews";
  const fallbackKey = "dishnu-memory-wall-fallback-v1";
  const state = { reviews: [], storage: "browser" };
  let ui;

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function loadFallback() {
    try {
      const saved = JSON.parse(localStorage.getItem(fallbackKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveFallback(reviews) {
    try {
      localStorage.setItem(fallbackKey, JSON.stringify(reviews));
    } catch {
      /* Browsers may block storage for file previews; the wall remains usable. */
    }
  }

  function normaliseReview(value) {
    const name = String(value.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const message = String(value.message || "").trim().replace(/\s+/g, " ").slice(0, 420);
    const rating = Number(value.rating);
    if (!name || !message || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Please add your name, a short note, and a rating.");
    }
    return { name, message, rating };
  }

  function fallbackReview(review) {
    return {
      id: "browser-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: review.name,
      message: review.message,
      rating: review.rating,
      createdAt: new Date().toISOString()
    };
  }

  async function readReviews() {
    try {
      const response = await fetch(apiPath, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Review service is unavailable.");
      const payload = await response.json();
      if (!Array.isArray(payload.reviews)) throw new Error("Review service returned invalid data.");
      state.storage = "server";
      return payload.reviews;
    } catch {
      state.storage = "browser";
      return loadFallback();
    }
  }

  async function writeReview(review) {
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(review)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to save this review.");
      }
      state.storage = "server";
      return await response.json();
    } catch {
      state.storage = "browser";
      const saved = loadFallback();
      const stored = fallbackReview(review);
      saveFallback([stored, ...saved]);
      return stored;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function stars(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function setStatus(message, isError) {
    if (!ui) return;
    ui.status.textContent = message;
    ui.status.classList.toggle("is-error", Boolean(isError));
  }

  function setRating(rating) {
    ui.rating = rating;
    ui.starButtons.forEach((button, index) => {
      const selected = index < rating;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function visibleReviews() {
    const searchTerm = ui.search.value.trim().toLocaleLowerCase();
    const selectedRating = Number(ui.ratingFilter.value);
    const selected = state.reviews.filter((review) => {
      const matchesSearch = !searchTerm || (review.name + " " + review.message).toLocaleLowerCase().includes(searchTerm);
      return matchesSearch && (!selectedRating || Number(review.rating) === selectedRating);
    });
    return selected.sort((first, second) => {
      if (ui.sort.value === "rating") return Number(second.rating) - Number(first.rating) || new Date(second.createdAt) - new Date(first.createdAt);
      return new Date(second.createdAt) - new Date(first.createdAt);
    });
  }

  function renderReviews() {
    const reviews = visibleReviews();
    ui.cards.replaceChildren();
    if (!reviews.length) {
      const empty = create("p", "memory-empty", "No matching visitor memories yet. Be the first to leave a mark.");
      ui.cards.append(empty);
    } else {
      reviews.forEach((review, index) => {
        const card = create("article", "memory-card memory-tint-" + (index % 5));
        const heading = create("div", "memory-card-heading");
        const name = create("h3", "", review.name);
        const rating = create("span", "memory-card-rating", stars(Number(review.rating)));
        rating.setAttribute("aria-label", String(review.rating) + " out of 5 stars");
        heading.append(name, rating);
        card.append(heading, create("time", "", formatDate(review.createdAt)), create("p", "", review.message));
        ui.cards.append(card);
      });
    }
    ui.count.textContent = String(state.reviews.length);
    ui.resultCount.textContent = String(reviews.length) + (reviews.length === 1 ? " note" : " notes");
  }

  async function refresh() {
    setStatus("Loading visitor memories…");
    state.reviews = await readReviews();
    renderReviews();
    setStatus(state.storage === "server" ? "Shared storage active · entries are saved to assets/data/memory-wall.json." : "Browser-only preview · start the review service to share and save entries to the asset folder.");
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
    ui.submit.disabled = true;
    setStatus("Posting your note…");
    await writeReview(review);
    ui.form.reset();
    ui.counter.textContent = "0/420";
    setRating(5);
    await refresh();
    ui.submit.disabled = false;
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
    const count = create("strong", "", "0");
    countPanel.append(count, create("span", "", "Notes on the wall"));
    hero.append(heroCopy, countPanel);

    const body = create("div", "memory-wall-body");
    const form = create("form", "memory-form");
    const formTitle = create("h3", "", "Add your note");
    form.append(formTitle, create("p", "", "Leave a small piece of your visit inside this interactive portfolio."));
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
      star.setAttribute("aria-label", "Set rating to " + rating + " out of 5");
      star.addEventListener("click", () => setRating(rating));
      starButtons.push(star);
      starsPanel.append(star);
    }
    const submit = create("button", "memory-submit", "Post to the wall");
    submit.type = "submit";
    form.append(createLabel("Your name", name), name, createLabel("Your message", message), message, counter, ratingLegend, starsPanel, submit);

    const content = create("section", "memory-notes");
    const toolbar = create("div", "memory-toolbar");
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search notes…";
    search.setAttribute("aria-label", "Search visitor notes");
    const sort = document.createElement("select");
    sort.setAttribute("aria-label", "Sort notes");
    [["newest", "Newest first"], ["rating", "Highest rating"]].forEach(([value, label]) => {
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
    const resultsMeta = create("p", "memory-results-meta", "0 notes");
    const cards = create("div", "memory-cards");
    content.append(toolbar, resultsMeta, cards);
    body.append(form, content);
    const status = create("p", "memory-status");
    status.setAttribute("role", "status");
    shell.append(hero, body, status);

    message.addEventListener("input", () => { counter.textContent = message.value.length + "/420"; });
    search.addEventListener("input", renderReviews);
    sort.addEventListener("change", renderReviews);
    ratingFilter.addEventListener("change", renderReviews);
    form.addEventListener("submit", submitReview);
    return { shell, form, name, message, counter, rating: 5, starButtons, submit, search, sort, ratingFilter, cards, count, resultCount: resultsMeta, status };
  }

  function open() {
    const modal = document.getElementById("detailsModal");
    const windowElement = document.getElementById("detailsWindow");
    const content = document.getElementById("modalContent");
    const label = document.getElementById("modalLabel");
    const close = document.getElementById("modalClose");
    const panelBar = windowElement.querySelector(".panel-bar");
    if (!panelBar.contains(close)) panelBar.append(close);
    ui = buildWall();
    content.replaceChildren(ui.shell);
    windowElement.classList.remove("is-resume-viewer", "is-dark-view", "is-light-view");
    windowElement.classList.add("is-memory-wall");
    label.textContent = "MEMORY WALL";
    close.setAttribute("aria-label", "Close Memory Wall");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    setRating(5);
    refresh();
  }

  return { open };
})();
