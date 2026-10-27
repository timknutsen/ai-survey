(() => {
  "use strict";

  // ---------- Survey definition ----------

  const STEPS = [
    { id: "intro", type: "intro" },
    {
      id: "frequency", type: "slider",
      title: "How often do you use AI tools in your work?",
      levels: ["Never", "A few times a year", "Monthly", "Weekly", "Daily", "Many times a day"],
      initial: 2,
    },
    {
      id: "uses", type: "multi",
      title: "How are you using AI today?",
      hint: "Pick all that apply.",
      options: ["Writing / editing", "Coding", "Literature / search", "Data analysis", "Brainstorming",
        "Summarising", "Presentations", "Other", "I barely use it"],
      exclusive: "I barely use it",
    },
    {
      id: "time_sink", type: "text",
      title: "What do you spend too much time doing?",
      hint: "Anything repetitive, tedious, slow, or annoying.",
    },
    {
      id: "familiar", type: "cards",
      title: "Which of these sound familiar?",
      hint: "React to each one. No right answers.",
      cards: [
        { key: "papers", text: "I have 20 papers or documents and need to understand what matters." },
        { key: "data_analysis", text: "I have data but don't know the best way to analyse or visualise it." },
        { key: "reports", text: "I repeatedly write similar reports or documentation." },
        { key: "foreign_code", text: "I need to understand code or scripts I didn't write." },
        { key: "format_convert", text: "I spend time converting information from one format to another." },
        { key: "compare", text: "I need to compare experiments, methods, results or specifications." },
        { key: "find_info", text: "I know the information exists somewhere, but finding it is painful." },
        { key: "get_started", text: "I have an idea but struggle to get started." },
        { key: "excel_cleaning", text: "I do repetitive Excel or data-cleaning work." },
        { key: "explain", text: "I need to explain technical material to different audiences." },
      ],
      reactions: [
        { v: "do", label: "I do this" },
        { v: "wish", label: "I wish AI could help with this" },
        { v: "na", label: "Not relevant" },
      ],
    },
    {
      id: "never_again", type: "text",
      title: "Pick one task you'd happily never do manually again.",
      hint: "Be specific. \"Formatting the monthly report tables\" beats \"reporting\".",
    },
    {
      id: "last_bad_day", type: "text",
      title: "Think about your last frustrating workday. What were you doing?",
      hint: "What made it slow or annoying?",
    },
    {
      id: "ai_better", type: "text",
      title: "What would you like AI to be better at helping you with?",
      hint: "Tap an example to add it, or write your own.",
      examples: ["Finding things in our own documents", "Checking my analysis or code",
        "Drafting first versions", "Cleaning and merging spreadsheets", "Meeting notes and follow-ups",
        "Explaining results to non-specialists"],
    },
    {
      id: "barriers", type: "multi",
      title: "What stops you using AI more?",
      hint: "Pick all that apply.",
      options: ["Don't know what it can do", "Don't know how to prompt it", "Accuracy / trust",
        "Confidentiality / data concerns", "Tools aren't available", "Tried it and results weren't useful",
        "Don't have time to learn", "Nothing"],
      exclusive: "Nothing",
    },
    {
      id: "demo", type: "choice",
      title: "Would you like us to show you how AI could help with one of your actual tasks?",
      options: ["Yes", "Maybe", "No"],
      contactFor: ["Yes", "Maybe"],
    },
    {
      id: "open", type: "text",
      title: "Describe any task, problem, annoyance, or workflow you have.",
      hint: "You do not need to know whether AI can help. That's our job.",
    },
    { id: "done", type: "result" },
  ];

  const ARCHETYPES = {
    data: { emoji: "🧮", name: "Data Wrangler", blurb: "Spreadsheets fear you. You'd rather spend your time on what the numbers mean than on getting them into shape." },
    lit: { emoji: "🤿", name: "Literature Diver", blurb: "You go deep into papers and documents. The hard part is surfacing with the bit that matters." },
    code: { emoji: "🛠️", name: "Code Tinkerer", blurb: "Scripts, pipelines, someone else's code at 4 pm on a Friday. You like making things work." },
    docs: { emoji: "📝", name: "Report Smith", blurb: "You turn work into words, slides and documentation, often the same shape every time." },
    meet: { emoji: "🛟", name: "Meeting Survivor", blurb: "Emails, meetings and follow-ups eat the day. The real work happens in the gaps." },
    idea: { emoji: "💡", name: "Idea Sparker", blurb: "Plenty of ideas; the blank page is the enemy. You want a sparring partner to get moving." },
  };

  // How answers feed each archetype (card reaction "wish" counts double)
  const USE_MAP = {
    "Data analysis": "data", "Literature / search": "lit", "Summarising": "lit", "Coding": "code",
    "Writing / editing": "docs", "Presentations": "docs", "Brainstorming": "idea",
  };
  const CARD_MAP = {
    papers: "lit", find_info: "lit", data_analysis: "data", excel_cleaning: "data", format_convert: "data",
    compare: "data", foreign_code: "code", reports: "docs", explain: "docs", get_started: "idea",
  };
  const KEYWORDS = {
    meet: /meeting|møte|email|e-post|mail|teams|calendar|admin|follow.?up|minutes|referat/i,
    data: /excel|spreadsheet|data|csv|regneark|tabell|clean/i,
    lit: /paper|article|literature|search|artikkel|litteratur|read/i,
    code: /code|script|python|\br\b|sql|bug|kode|pipeline/i,
    docs: /report|rapport|document|slide|presentation|write|skriv/i,
  };

  // ---------- State ----------

  const STORE = "friction-survey-v1";
  const cfg = window.SURVEY_CONFIG || {};
  const params = new URLSearchParams(location.search);

  let state = load() || {
    id: uuid(),
    step: 0,
    cardIndex: 0,
    name: params.get("name") || "",
    team: params.get("team") || "",
    contact: "",
    answers: {},
    completed: false,
    archetype: null,
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
  }
  function persistLocal() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ }
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  }

  // ---------- Saving to Supabase ----------

  let saveTimer = null;
  let saving = Promise.resolve();

  function save(now = false) {
    persistLocal();
    clearTimeout(saveTimer);
    if (now) return flush();
    saveTimer = setTimeout(flush, 800);
    return saving;
  }

  function flush() {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      setStatus("Not connected to a database (config.js is empty). Answers are only kept in this browser.");
      return Promise.resolve(false);
    }
    const headers = { "Content-Type": "application/json", apikey: cfg.supabaseKey };
    // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys must not
    if (cfg.supabaseKey.startsWith("eyJ")) headers.Authorization = "Bearer " + cfg.supabaseKey;
    const body = {
      p_id: state.id,
      p_name: state.name.trim() || null,
      p_team: state.team.trim() || null,
      p_contact: state.contact.trim() || null,
      p_step: state.step,
      p_completed: state.completed,
      p_archetype: state.archetype,
      p_answers: state.answers,
      p_user_agent: navigator.userAgent.slice(0, 300),
    };
    saving = saving.then(() =>
      fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/save_ai_survey_response", {
        method: "POST", headers, body: JSON.stringify(body), keepalive: true,
      }).then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        setStatus(state.completed ? "Your answers are saved. Thank you!" : "Saved");
        return true;
      }).catch(err => {
        console.error("Save failed", err);
        setStatus("Couldn't save just now; we'll retry on the next step.");
        return false;
      })
    );
    return saving;
  }

  function setStatus(msg) { document.getElementById("status").textContent = msg; }

  // ---------- Rendering helpers ----------

  const app = document.getElementById("app");

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, "");
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
  }

  function actions(canContinue, label = "Continue") {
    const btn = el("button", { class: "primary", onclick: next }, label);
    btn.disabled = !canContinue;
    const skip = el("button", { class: "ghost", onclick: next }, "Skip");
    return { row: el("div", { class: "actions" }, skip, btn), btn };
  }

  // ---------- Navigation ----------

  const QUESTION_STEPS = STEPS.filter(s => s.type !== "intro" && s.type !== "result").length;

  function next() {
    if (state.step < STEPS.length - 1) state.step++;
    if (STEPS[state.step].type === "result") finish();
    save();
    render();
    window.scrollTo(0, 0);
  }

  function back() {
    const step = STEPS[state.step];
    if (step.type === "cards" && state.cardIndex > 0) { state.cardIndex--; render(); return; }
    if (state.step > 0) state.step--;
    const prev = STEPS[state.step];
    if (prev.type === "cards") state.cardIndex = prev.cards.length - 1;
    persistLocal();
    render();
  }
  document.getElementById("back").addEventListener("click", back);

  function updateChrome() {
    const step = STEPS[state.step];
    const qIndex = STEPS.slice(0, state.step + 1).filter(s => s.type !== "intro" && s.type !== "result").length;
    let frac = qIndex / QUESTION_STEPS;
    if (step.type === "cards") frac = (qIndex - 1 + state.cardIndex / step.cards.length) / QUESTION_STEPS;
    if (step.type === "result") frac = 1;
    if (step.type === "intro") frac = 0;
    document.getElementById("bar").style.width = Math.round(frac * 100) + "%";
    document.getElementById("count").textContent =
      step.type === "intro" || step.type === "result" ? "" : `${qIndex} / ${QUESTION_STEPS}`;
    document.getElementById("back").hidden = step.type === "intro" || step.type === "result";
  }

  function render() {
    updateChrome();
    const step = STEPS[state.step];
    const screen = el("section", { class: "screen" });
    ({ intro: renderIntro, slider: renderSlider, multi: renderMulti, text: renderText,
      cards: renderCards, choice: renderChoice, result: renderResult })[step.type](step, screen);
    app.replaceChildren(screen);
    const focusable = screen.querySelector("textarea, input[type=text]");
    if (focusable && step.type !== "intro") focusable.focus({ preventScroll: true });
  }

  // ---------- Screens ----------

  function renderIntro(_, s) {
    const name = el("input", { type: "text", value: state.name, autocomplete: "name", placeholder: "Leave blank to stay anonymous" });
    name.addEventListener("input", () => { state.name = name.value; persistLocal(); });
    const team = el("input", { type: "text", value: state.team, placeholder: "e.g. Genetics, Production, Sales" });
    team.addEventListener("input", () => { state.team = team.value; persistLocal(); });
    const resuming = state.step === 0 && Object.keys(state.answers).length > 0;
    s.append(
      el("h1", {}, "What slows your work down?"),
      el("p", { class: "hint" },
        "Five minutes, mostly taps. This is not a test of what you know about AI. " +
        "We want to hear about the tedious, repetitive and annoying parts of your work, " +
        "so we can find where AI could actually help."),
      el("label", { class: "field" }, el("span", {}, "Your name (optional)"), name),
      el("label", { class: "field" }, el("span", {}, "Team or department (optional)"), team),
      el("p", { class: "small" }, "Answers are saved as you go. Leave the name blank to answer anonymously."),
      el("div", { class: "actions" }, el("span"),
        el("button", { class: "primary", onclick: next }, resuming ? "Continue where I left off" : "Start")),
    );
  }

  function renderSlider(step, s) {
    if (state.answers[step.id] == null) state.answers[step.id] = step.levels[step.initial];
    let idx = Math.max(0, step.levels.indexOf(state.answers[step.id]));
    const value = el("div", { class: "slider-value" }, step.levels[idx]);
    const range = el("input", { type: "range", min: 0, max: step.levels.length - 1, step: 1, value: idx, "aria-label": step.title });
    range.addEventListener("input", () => {
      idx = +range.value;
      value.textContent = step.levels[idx];
      state.answers[step.id] = step.levels[idx];
      persistLocal();
    });
    s.append(
      el("h2", {}, step.title),
      el("p", { class: "hint" }, "Drag the slider."),
      el("div", { class: "slider-wrap" }, value, range,
        el("div", { class: "slider-ends" }, el("span", {}, step.levels[0]), el("span", {}, step.levels.at(-1)))),
      actions(true).row,
    );
  }

  function renderMulti(step, s) {
    const picked = new Set(state.answers[step.id] || []);
    const { row, btn } = actions(picked.size > 0);
    const other = el("input", { type: "text", placeholder: "Other: tell us what", value: state.answers[step.id + "_other"] || "" });
    other.hidden = !picked.has("Other");
    other.addEventListener("input", () => { state.answers[step.id + "_other"] = other.value; persistLocal(); });

    const chips = step.options.map(opt => {
      const chip = el("button", { class: "chip", "aria-pressed": String(picked.has(opt)) }, opt);
      chip.addEventListener("click", () => {
        if (picked.has(opt)) picked.delete(opt);
        else {
          if (opt === step.exclusive) picked.clear();
          else picked.delete(step.exclusive);
          picked.add(opt);
        }
        state.answers[step.id] = [...picked];
        chipsEl.querySelectorAll(".chip").forEach((c, i) => c.setAttribute("aria-pressed", String(picked.has(step.options[i]))));
        other.hidden = !picked.has("Other");
        btn.disabled = picked.size === 0;
        persistLocal();
      });
      return chip;
    });
    const chipsEl = el("div", { class: "chips" }, chips);
    s.append(el("h2", {}, step.title), el("p", { class: "hint" }, step.hint), chipsEl,
      el("div", { style: "margin-top:12px" }, other), row);
  }

  function renderText(step, s) {
    const ta = el("textarea", { placeholder: "Type here…", "aria-label": step.title });
    ta.value = state.answers[step.id] || "";
    const { row, btn } = actions(ta.value.trim().length > 0);
    ta.addEventListener("input", () => {
      state.answers[step.id] = ta.value;
      btn.disabled = ta.value.trim().length === 0;
      persistLocal();
    });
    s.append(el("h2", {}, step.title), el("p", { class: "hint" }, step.hint), ta);
    if (step.examples) {
      s.append(el("div", { class: "examples chips" }, step.examples.map(ex =>
        el("button", {
          class: "chip", onclick: () => {
            ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, "") + "\n" + ex : ex;
            ta.dispatchEvent(new Event("input"));
          },
        }, "+ " + ex))));
    }
    s.append(row);
  }

  function renderCards(step, s) {
    const reactions = state.answers[step.id] || (state.answers[step.id] = {});
    const i = Math.min(state.cardIndex, step.cards.length - 1);
    const card = step.cards[i];
    s.append(
      el("h2", {}, step.title),
      el("p", { class: "hint" }, step.hint),
      el("div", { class: "card-count" }, `Card ${i + 1} of ${step.cards.length}`),
      el("div", { class: "card" }, card.text),
      el("div", { class: "reactions" }, step.reactions.map(r =>
        el("button", {
          class: "react " + r.v, "aria-pressed": String(reactions[card.key] === r.v),
          onclick: () => {
            reactions[card.key] = r.v;
            if (i < step.cards.length - 1) {
              state.cardIndex = i + 1;
              persistLocal();
              setTimeout(render, 120);
            } else {
              state.cardIndex = 0;
              setTimeout(next, 120);
            }
          },
        }, r.label))),
      el("div", { class: "actions" },
        el("button", {
          class: "ghost", onclick: () => {
            if (i < step.cards.length - 1) { state.cardIndex = i + 1; persistLocal(); render(); }
            else { state.cardIndex = 0; next(); }
          },
        }, "Skip card"), el("span")),
    );
  }

  function renderChoice(step, s) {
    const contact = el("input", { type: "text", value: state.contact, autocomplete: "email", placeholder: "Email or phone" });
    contact.addEventListener("input", () => { state.contact = contact.value; persistLocal(); });
    const contactField = el("label", { class: "field", style: "margin-top:18px" },
      el("span", {}, "How can we reach you? (optional)"), contact);
    const { row, btn } = actions(!!state.answers[step.id]);
    const showContact = () => { contactField.hidden = !step.contactFor.includes(state.answers[step.id]); };
    const opts = el("div", { class: "options" }, step.options.map(opt =>
      el("button", {
        class: "option", "aria-pressed": String(state.answers[step.id] === opt),
        onclick: e => {
          state.answers[step.id] = opt;
          opts.querySelectorAll(".option").forEach(o => o.setAttribute("aria-pressed", "false"));
          e.currentTarget.setAttribute("aria-pressed", "true");
          btn.disabled = false;
          showContact();
          persistLocal();
        },
      }, opt)));
    showContact();
    s.append(el("h2", {}, step.title), el("p", { class: "hint" }, "No commitment."), opts, contactField, row);
  }

  // ---------- Archetype ----------

  function computeArchetype() {
    const score = Object.fromEntries(Object.keys(ARCHETYPES).map(k => [k, 0]));
    for (const u of state.answers.uses || []) if (USE_MAP[u]) score[USE_MAP[u]] += 1;
    for (const [key, r] of Object.entries(state.answers.familiar || {})) {
      if (CARD_MAP[key]) score[CARD_MAP[key]] += r === "wish" ? 2 : r === "do" ? 1 : 0;
    }
    const text = ["time_sink", "never_again", "last_bad_day", "ai_better", "open"]
      .map(k => state.answers[k] || "").join(" ");
    for (const [k, re] of Object.entries(KEYWORDS)) if (re.test(text)) score[k] += 2;
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : "idea";
  }

  function finish() {
    state.archetype = ARCHETYPES[computeArchetype()].name;
    state.completed = true;
  }

  function renderResult(_, s) {
    const a = Object.values(ARCHETYPES).find(x => x.name === state.archetype) || ARCHETYPES.idea;
    s.append(
      el("p", { class: "hint", style: "margin-top:12px" }, "Thanks" + (state.name.trim() ? ", " + state.name.trim().split(" ")[0] : "") + "! Your AI archetype:"),
      el("div", { class: "archetype" },
        el("div", { class: "emoji" }, a.emoji), el("h1", {}, a.name), el("p", {}, a.blurb)),
      el("p", {}, "We'll sort what everyone sends into quick wins we can teach, workflows worth building, " +
        "and bigger problems that might justify proper tools."),
      el("div", { class: "actions" },
        el("button", {
          class: "ghost", onclick: () => {
            try { localStorage.removeItem(STORE); } catch { }
            location.href = location.pathname;
          },
        }, "Start a new response"), el("span")),
    );
    save(true);
  }

  render();
  if (state.step > 0) save();
})();
