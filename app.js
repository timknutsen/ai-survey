(() => {
  "use strict";

  const QUESTIONS = [
    {
      id: "frequency", type: "choice",
      title: "How often do you use AI at work?",
      hint: "Any AI tool counts. Pick the closest answer.",
      options: ["Never", "A few times a year", "Monthly", "Weekly", "Daily", "Many times a day"],
      descriptions: { "Daily": "About once a day", "Many times a day": "Several times during a workday" },
    },
    {
      id: "tools", type: "multi", max: 3,
      title: "Which AI tools do you currently use?",
      hint: "Choose up to three you use most. Use Other for anything missing.",
      options: ["ChatGPT", "Claude", "Claude Science", "Gemini", "Microsoft Copilot", "GitHub Copilot",
        "Codex", "Cursor", "NotebookLM", "Perplexity", "Elicit", "Consensus", "scite", "ResearchRabbit", "Other", "None yet"],
      exclusive: "None yet",
    },
    {
      id: "time_sink", type: "text",
      title: "What is one task you would like to spend less time on?",
      hint: "One example is enough. A sentence or two will do.",
      placeholder: "For example: cleaning spreadsheets before I can analyse the data.",
    },
    {
      id: "barriers", type: "choice", array: true,
      title: "What is your main barrier to using AI?",
      hint: "Pick the one that matters most to you.",
      options: ["I don't understand AI's real potential", "Life-science tools feel too complicated",
        "Not knowing where to start", "Accuracy / trust", "Confidentiality / data concerns",
        "Access to suitable tools", "Time to learn", "Nothing", "Other"],
      other: true,
    },
    {
      id: "demo", type: "choice",
      title: "Would you like help trying AI on a real task?",
      hint: "We could use your example for a practical demo. No commitment.",
      options: ["Yes", "Maybe", "No"],
      followUp: true,
    },
  ];

  const STORE = "friction-survey-v3";
  const LEGACY_STORES = ["friction-survey-v2", "friction-survey-v1"];
  const cfg = window.SURVEY_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const app = document.getElementById("app");
  let state = load();
  let saveTimer;
  let saving = Promise.resolve();
  let failed = false;

  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  function freshState() {
    return {
      version: 3, id: crypto.randomUUID(), step: 0,
      name: params.get("name") || "", team: params.get("team") || "", contact: "",
      answers: { _survey_version: 3 }, completed: false, archetype: null,
    };
  }

  function load() {
    const saved = readStore(STORE);
    if (saved && saved.version === 3 && typeof saved.id === "string" &&
        Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= QUESTIONS.length + 1 &&
        saved.answers && typeof saved.answers === "object" && !Array.isArray(saved.answers)) return saved;
    const legacy = LEGACY_STORES.map(readStore).find(value => value && typeof value.id === "string");
    // Keep completed responses visible without posting or rewriting their original answers.
    if (legacy && legacy.completed && typeof legacy.id === "string") {
      return { ...legacy, version: 3, step: QUESTIONS.length + 1, previousVersion: true };
    }
    // The shortened survey starts a separate response; any old draft stays untouched.
    return freshState();
  }

  function persistLocal() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* Storage may be unavailable. */ }
  }

  function payload() {
    const answers = { ...state.answers };
    if (state.answers.barriers?.[0] !== "Other") delete answers.barriers_other;
    if (!state.answers.tools?.includes("Other")) delete answers.tools_other;
    return {
      p_id: state.id, p_name: state.name.trim() || null, p_team: state.team.trim() || null,
      p_contact: state.contact.trim() || null, p_step: state.step, p_completed: state.completed,
      p_archetype: state.archetype, p_answers: answers, p_user_agent: navigator.userAgent.slice(0, 300),
    };
  }

  function setStatus(message) { document.getElementById("status").textContent = message; }

  function save(immediate = false) {
    persistLocal();
    clearTimeout(saveTimer);
    if (state.previousVersion) return;
    if (immediate) return flush();
    saveTimer = setTimeout(flush, 500);
  }

  function flush() {
    clearTimeout(saveTimer);
    const body = payload();
    const headers = { "Content-Type": "application/json", apikey: cfg.supabaseKey };
    if (cfg.supabaseKey?.startsWith("eyJ")) headers.Authorization = "Bearer " + cfg.supabaseKey;
    setStatus(body.p_completed ? "Sending your response…" : "Saving…");
    saving = saving.then(async () => {
      try {
        if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error("Survey connection unavailable");
        const response = await fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/save_ai_survey_response", {
          method: "POST", headers, body: JSON.stringify(body), keepalive: true,
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        failed = false;
        setStatus(body.p_completed ? "Your response is saved. Thank you!" : "Saved");
        document.getElementById("retry").hidden = true;
        if (body.p_completed && state.id === body.p_id) {
          state.sent = true;
          persistLocal();
          const receipt = document.getElementById("receipt");
          if (receipt) receipt.textContent = "Your response is saved.";
        }
      } catch (error) {
        failed = true;
        setStatus("Could not save just now. Please retry.");
        document.getElementById("retry").hidden = false;
        const receipt = document.getElementById("receipt");
        if (receipt) receipt.textContent = "Your response has not been sent yet. Keep this page open and tap Retry saving.";
        console.error("Survey save failed", error);
      }
    });
    return saving;
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, "");
      else if (value !== false && value != null) node.setAttribute(key, value);
    }
    for (const child of children.flat()) if (child != null) node.append(child);
    return node;
  }

  function next() {
    state.step++;
    if (state.step === QUESTIONS.length + 1) state.completed = true;
    render();
    save(true);
    window.scrollTo(0, 0);
  }

  function actions(ready) {
    const final = state.step === QUESTIONS.length;
    const submit = el("button", { class: "primary", onclick: next, disabled: !ready }, final ? "Send response" : "Continue");
    const skip = el("button", { class: "ghost", onclick: next }, final ? "Skip and send" : "Skip");
    return { row: el("div", { class: "actions" }, skip, submit), submit };
  }

  function identityField(key, label, placeholder) {
    const input = el("input", { type: "text", maxlength: 200, value: state[key], placeholder,
      ...(key === "name" ? { autocomplete: "name" } : {}) });
    input.addEventListener("input", () => { state[key] = input.value; persistLocal(); });
    return el("label", { class: "field" }, el("span", {}, label), input);
  }

  function renderChoice(question, screen) {
    const selected = () => question.array ? state.answers[question.id]?.[0] : state.answers[question.id];
    const { row, submit } = actions(!!selected());
    const options = el("div", { class: "options" + (question.id === "frequency" ? " frequency-options" : ""), role: "group", "aria-label": question.title });
    const other = el("input", { type: "text", maxlength: 400, "aria-label": "Other: tell us briefly",
      placeholder: "Tell us briefly (optional)", value: state.answers[question.id + "_other"] || "" });
    other.hidden = selected() !== "Other";
    other.addEventListener("input", () => { state.answers[question.id + "_other"] = other.value; save(); });
    const contact = el("input", { type: "text", maxlength: 200, autocomplete: "email",
      placeholder: "Email or Teams name", value: state.contact });
    contact.addEventListener("input", () => { state.contact = contact.value; save(); });
    const contactField = el("label", { class: "field follow-up" },
      el("span", {}, "How we can reach you (optional)"), contact);
    contactField.hidden = !["Yes", "Maybe"].includes(selected());
    for (const option of question.options) {
      options.append(el("button", {
        class: "option", "aria-label": option, "aria-pressed": String(selected() === option),
        onclick: () => {
          state.answers[question.id] = question.array ? [option] : option;
          options.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.getAttribute("aria-label") === option)));
          submit.disabled = false;
          other.hidden = option !== "Other";
          contactField.hidden = !["Yes", "Maybe"].includes(option);
          if (question.followUp && option === "No") { state.contact = ""; contact.value = ""; }
          save();
        },
      }, el("span", { class: "option-label" }, option),
      question.descriptions?.[option] ? el("span", { class: "option-description" }, question.descriptions[option]) : null));
    }
    screen.append(options);
    if (question.other) screen.append(other);
    if (question.followUp) screen.append(contactField);
    screen.append(row);
  }

  function renderMulti(question, screen) {
    const picked = new Set(state.answers[question.id] || []);
    const { row, submit } = actions(picked.size > 0);
    const limit = el("p", { class: "selection-count", id: "selection-limit", role: "status" });
    const options = el("div", { class: "options tool-options", role: "group", "aria-label": question.title,
      "aria-describedby": "question-hint selection-limit" });
    const other = el("input", { type: "text", maxlength: 400, "aria-label": "Other AI tools",
      placeholder: "Name the other tool", value: state.answers.tools_other || "" });
    other.addEventListener("input", () => { state.answers.tools_other = other.value; save(); });
    function update() {
      options.querySelectorAll("button").forEach(button => {
        const value = button.getAttribute("aria-label");
        button.setAttribute("aria-pressed", String(picked.has(value)));
        button.disabled = picked.size >= question.max && !picked.has(value) && value !== question.exclusive;
      });
      limit.textContent = `${picked.size} of ${question.max} selected` +
        (picked.size === question.max ? ". Unselect one to choose another." : ".");
      other.hidden = !picked.has("Other");
      submit.disabled = picked.size === 0;
    }
    for (const option of question.options) {
      options.append(el("button", { class: "option", "aria-label": option, onclick: () => {
        if (picked.has(option)) picked.delete(option);
        else {
          if (option === question.exclusive) picked.clear();
          else picked.delete(question.exclusive);
          if (picked.size < question.max) picked.add(option);
        }
        state.answers[question.id] = [...picked];
        update(); save();
      } }, option));
    }
    update();
    screen.append(limit, options, other, row);
  }

  function renderText(question, screen) {
    const input = el("textarea", { rows: 4, maxlength: 600, placeholder: question.placeholder,
      "aria-label": question.title, "aria-describedby": "question-hint" });
    input.value = state.answers[question.id] || "";
    const { row, submit } = actions(!!input.value.trim());
    input.addEventListener("input", () => {
      state.answers[question.id] = input.value;
      submit.disabled = !input.value.trim();
      save();
    });
    screen.append(input, el("p", { class: "small" }, "Please leave out confidential details."), row);
  }

  function render() {
    const intro = state.step === 0;
    const done = state.step === QUESTIONS.length + 1;
    document.getElementById("back").hidden = intro || done;
    document.getElementById("bar").style.width = (done ? 100 : Math.max(0, state.step - 1) / QUESTIONS.length * 100) + "%";
    document.getElementById("count").textContent = intro ? "5 questions" : done ? "Done" : `${state.step} of ${QUESTIONS.length}`;
    const screen = el("section", { class: "screen" });
    if (intro) {
      screen.append(
        el("p", { class: "eyebrow" }, "5 questions · about 3 minutes"),
        el("h1", { tabindex: -1 }, "What slows your work down?"),
        el("p", { class: "hint" }, "Tell us about one task and where AI might help. No AI experience needed."),
        el("p", { class: "small" }, "Mostly quick choices, with one short written answer. Every question is optional. Your name is optional too."),
        identityField("name", "Your name (optional)", "Leave blank to answer without your name"),
        el("details", { class: "identity", open: !!state.team }, el("summary", {}, "Add your team (optional)"),
          identityField("team", "Team or department", "e.g. Genetics, Production, Sales")),
        el("div", { class: "actions" }, el("button", { class: "primary", onclick: next }, "Start")),
        el("p", { class: "small" }, "Your progress is saved as you go."),
      );
    } else if (done) {
      screen.append(
        el("p", { class: "eyebrow" }, "All done"),
        el("h1", { tabindex: -1 }, state.name.trim() ? `Thanks, ${state.name.trim().split(" ")[0]}!` : "Thank you!"),
        el("p", { class: "hint", id: "receipt" }, state.sent || state.previousVersion ? "Your response is saved." : "Sending your response…"),
        el("p", {}, "Your answers will help us choose useful AI demos and practical support for everyday work."),
        el("button", { class: "ghost new-response", onclick: () => {
          state = freshState(); persistLocal(); failed = false;
          document.getElementById("retry").hidden = true; setStatus(""); render();
        } }, "Start a new response"),
      );
    } else {
      const question = QUESTIONS[state.step - 1];
      screen.append(el("p", { class: "eyebrow" }, `Question ${state.step} of ${QUESTIONS.length}`),
        el("h1", { tabindex: -1 }, question.title), el("p", { class: "hint", id: "question-hint" }, question.hint));
      if (question.type === "text") renderText(question, screen);
      else if (question.type === "multi") renderMulti(question, screen);
      else renderChoice(question, screen);
    }
    app.replaceChildren(screen);
    if (!intro) screen.querySelector("h1").focus({ preventScroll: true });
  }

  document.getElementById("back").addEventListener("click", () => {
    if (state.step > 0 && !state.completed) state.step--;
    persistLocal(); render();
  });
  document.getElementById("retry").addEventListener("click", () => save(true));
  window.addEventListener("online", () => { if (failed) save(true); });
  window.addEventListener("pagehide", () => { if (saveTimer) flush(); });
  render();
  if (state.step > 0 && !state.previousVersion && !state.sent) save(true);
})();
