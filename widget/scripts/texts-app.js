// Binxbar TEXTS app: your text conversations on the Edge, with replies typed on Binxbar (keyboard or touch keyboard).
// Incoming texts come from mic-guard (resources/texts.jsonl, made from Phone Link's Windows notifications, kept on this PC).
// Sending: the request is left in Binxbar's own storage and the phone key is pressed; the PC script types it into Phone Link, out of sight.
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const WAKE_KEY = 23;
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const digits = s => String(s || "").replace(/\D/g, "");
    const pretty = n => { const d = digits(n); const m = d.match(/^1?(\d{3})(\d{3})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n; };
    let contacts = [], incoming = [], sent = [], page = "list", openKey = null, draft = "", query = "", backTimer = null, statusTimer = null;
    try { sent = JSON.parse(localStorage.getItem("binxbar.texts.sent") || "[]"); } catch (e) { sent = []; }
    let readUpTo = 0; try { readUpTo = Number(localStorage.getItem("binxbar.texts.read") || 0); } catch (e) {}

    function loadContacts() { fetch("resources/contacts.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : []).then(l => { contacts = Array.isArray(l) ? l : []; }).catch(() => {}); }
    function loadTexts() {
        fetch("resources/texts.jsonl?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(t => {
            const list = []; String(t).split("\n").forEach(l => { try { if (l.trim()) list.push(JSON.parse(l)); } catch (e) {} });
            const changed = list.length !== incoming.length; incoming = list;
            badge(); if (changed && isOpen()) render();
        }).catch(() => {});
    }
    // Who a conversation is with: a contact name (with their number), or just a number.
    function person(whoOrNumber) {
        const w = String(whoOrNumber || ""); const d = digits(w);
        if (d.length >= 7) { const c = contacts.find(x => x.p.some(p => digits(p.n).endsWith(d.slice(-10)))); return { key: "n:" + d.slice(-10), name: c ? c.n : pretty(w), number: c ? c.p[0].n : w }; }
        const c = contacts.find(x => norm(x.n) === norm(w)) || contacts.find(x => norm(x.n).startsWith(norm(w)) && norm(w).length > 2);
        return { key: c ? "n:" + digits(c.p[0].n).slice(-10) : "w:" + norm(w), name: c ? c.n : w, number: c ? c.p[0].n : "" };
    }
    function conversations() {
        const map = new Map();
        const add = (p, m) => { if (!map.has(p.key)) map.set(p.key, { ...p, msgs: [] }); const c = map.get(p.key); if (!c.number && p.number) c.number = p.number; c.msgs.push(m); };
        incoming.forEach(m => add(person(m.who), { t: m.t, body: m.body, mine: false }));
        sent.forEach(m => add(person(m.number), { t: m.t, body: m.body, mine: true }));
        return [...map.values()].map(c => { c.msgs.sort((a, b) => a.t - b.t); c.last = c.msgs[c.msgs.length - 1]; return c; }).sort((a, b) => b.last.t - a.last.t);
    }
    function badge() { const b = $("qkTextsCount"); if (!b) return; const n = incoming.filter(m => m.t > readUpTo).length; b.textContent = n ? String(Math.min(n, 99)) : ""; b.classList.toggle("on", n > 0); }
    function markRead() { readUpTo = Date.now(); try { localStorage.setItem("binxbar.texts.read", String(readUpTo)); } catch (e) {} badge(); }

    function status(msg, ms) { const s = $("txStatus"); if (!s) return; s.textContent = msg; s.classList.add("on"); clearTimeout(statusTimer); if (ms) statusTimer = setTimeout(() => s.classList.remove("on"), ms); }
    function send(conv, body) {
        body = String(body || "").trim(); if (!body) return;
        if (!conv.number || digits(conv.number).length < 7) { status("NO NUMBER FOR " + conv.name.toUpperCase() + " — REPLY IN PHONE LINK", 5000); return; }
        let b64 = ""; try { b64 = btoa(unescape(encodeURIComponent(body))); } catch (e) { return; }
        try { localStorage.setItem("binxbar.phone.req", "BINXREQ|text|" + digits(conv.number).replace(/^/, digits(conv.number).length === 10 ? "+1" : "+") + "|" + Date.now() + "|" + b64 + "|"); } catch (e) { status("COULDN'T SEND", 4000); return; }
        if (!(window.Binxbar && window.Binxbar.tapKey(WAKE_KEY))) { status("COULDN'T SEND", 4000); return; }
        sent.push({ t: Date.now(), number: conv.number, body }); sent = sent.slice(-300);
        try { localStorage.setItem("binxbar.texts.sent", JSON.stringify(sent)); } catch (e) {}
        draft = ""; status("SENDING …", 4000); render(true);
    }

    function isOpen() { return $("widget").dataset.view === "texts"; }
    function touch() { clearTimeout(backTimer); backTimer = setTimeout(close, 180000); }
    function open() { page = "list"; openKey = null; draft = ""; query = ""; $("widget").dataset.view = "texts"; markRead(); touch(); loadContacts(); loadTexts(); render(); }
    function close() { clearTimeout(backTimer); if (isOpen()) $("widget").dataset.view = "now"; }
    function ago(t) { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return "NOW"; if (m < 60) return m + "M"; const h = Math.round(m / 60); if (h < 24) return h + "H";
        return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(); }
    const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4.5" y2="12"></line><polyline points="10.5 5.5 4 12 10.5 18.5"></polyline></svg>';

    function nav(title, onBack, extra) {
        const bar = el("div", "fc-nav ph-nav");
        const back = el("span", "fc-btn fc-arrow"); back.innerHTML = BACK; back.addEventListener("click", ev => { ev.stopPropagation(); touch(); onBack(); });
        bar.append(back, el("div", "tx-title", title)); if (extra) bar.append(extra); return bar;
    }
    function listPage() {
        const body = el("div", "ph-ct");
        const neu = el("span", "fc-btn tx-new", "NEW TEXT"); neu.addEventListener("click", ev => { ev.stopPropagation(); touch(); page = "new"; query = ""; render(); });
        const pl = el("span", "fc-btn tx-new", "PHONE LINK"); pl.addEventListener("click", ev => { ev.stopPropagation(); touch(); try { localStorage.setItem("binxbar.phone.req", "BINXREQ|messages||" + Date.now() + "||"); } catch (e) {} window.Binxbar && window.Binxbar.tapKey(WAKE_KEY); status("OPENING PHONE LINK …", 3000); });
        const extra = el("div", "tx-acts"); extra.append(neu, pl);
        const list = el("div", "ph-grid tx-list");
        const convs = conversations();
        if (!convs.length) list.append(el("div", "ph-hint", "NO TEXTS YET. NEW TEXTS SHOW UP HERE AS THEY ARRIVE; OLDER ONES ARE IN PHONE LINK."));
        convs.forEach(c => {
            const row = el("div", "ph-card tx-conv" + (!c.last.mine && c.last.t > readUpTo - 1 && false ? " new" : ""));
            const top = el("div", "tx-conv-top"); top.append(el("div", "ph-name", c.name), el("div", "tx-ago", ago(c.last.t)));
            row.append(top, el("div", "tx-prev", (c.last.mine ? "YOU: " : "") + c.last.body));
            row.addEventListener("click", ev => { ev.stopPropagation(); touch(); openKey = c.key; page = "thread"; draft = ""; render(); });
            list.append(row);
        });
        body.append(nav("TEXTS", close, extra), list); return body;
    }
    function threadPage() {
        const conv = conversations().find(c => c.key === openKey) || (openKey && openKey.conv) || null;
        const c = conv || newConv; if (!c) { page = "list"; return listPage(); }
        const body = el("div", "ph-ct tx-thread");
        const msgs = el("div", "tx-msgs");
        if (!c.msgs.length) msgs.append(el("div", "ph-hint", "NEW CONVERSATION WITH " + c.name.toUpperCase()));
        c.msgs.slice(-80).forEach(m => { const b = el("div", "tx-bub " + (m.mine ? "me" : "them")); b.append(el("div", "tx-body", m.body), el("div", "tx-time", ago(m.t))); msgs.append(b); });
        const bar = el("div", "tx-compose");
        const input = document.createElement("textarea"); input.className = "tx-input"; input.rows = 1; input.placeholder = c.number ? "TYPE A MESSAGE" : "NO NUMBER — REPLY IN PHONE LINK"; input.value = draft;
        input.disabled = !c.number; input.setAttribute("spellcheck", "true");
        input.addEventListener("click", ev => ev.stopPropagation());
        input.addEventListener("input", () => { draft = input.value; touch(); });
        input.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); send(c, input.value); } else if (ev.key === "Escape") { page = "list"; render(); } });
        const go = el("span", "tx-send", "SEND"); go.addEventListener("click", ev => { ev.stopPropagation(); send(c, input.value); });
        bar.append(input, go);
        body.append(nav(c.name, () => { page = "list"; newConv = null; render(); }, c.number ? el("div", "tx-num", pretty(c.number)) : null), msgs, bar);
        setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; if (!input.disabled) { try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} } }, 30);
        return body;
    }
    let newConv = null;
    function newPage() {
        const body = el("div", "ph-ct");
        const field = el("label", "ph-field");
        const input = document.createElement("input"); input.type = "search"; input.className = "ph-input"; input.placeholder = "WHO ARE YOU TEXTING?"; input.value = query;
        input.addEventListener("click", ev => ev.stopPropagation());
        field.append(input);
        const grid = el("div", "ph-grid");
        const fill = () => {
            grid.textContent = ""; const q = norm(query);
            const list = q ? contacts.filter(c => norm(c.n).split(" ").some(w => w.startsWith(q)) || norm(c.n).includes(q) || (digits(q).length >= 3 && c.p.some(p => digits(p.n).includes(digits(q))))) : contacts;
            list.slice(0, 120).forEach(c => {
                const row = el("div", "ph-card"); row.append(el("div", "ph-name", c.n), el("div", "ph-sub", pretty(c.p[0].n)));
                row.addEventListener("click", ev => { ev.stopPropagation(); touch(); const p = person(c.p[0].n); newConv = { ...p, name: c.n, number: c.p[0].n, msgs: [] }; openKey = p.key; page = "thread"; draft = ""; render(); });
                grid.append(row);
            });
            if (digits(q).length >= 10) { const row = el("div", "ph-card"); row.append(el("div", "ph-name", "TEXT " + pretty(q))); row.addEventListener("click", ev => { ev.stopPropagation(); const p = person(q); newConv = { ...p, number: q, msgs: [] }; openKey = p.key; page = "thread"; render(); }); grid.prepend(row); }
        };
        input.addEventListener("input", () => { query = input.value; touch(); fill(); });
        input.addEventListener("keydown", ev => ev.stopPropagation());
        fill();
        body.append(nav("NEW TEXT", () => { page = "list"; render(); }), field, grid);
        setTimeout(() => { try { input.focus(); } catch (e) {} }, 30);
        return body;
    }
    function render() {
        const box = $("txApp"); if (!box) return;
        box.textContent = "";
        box.append(page === "thread" ? threadPage() : page === "new" ? newPage() : listPage());
        const st = el("div", "ph-status"); st.id = "txStatus"; box.append(st);
        if (isOpen()) markRead();
    }

    const icon = $("qkTexts");
    if (icon) icon.addEventListener("click", ev => { ev.stopPropagation(); open(); });
    const app = $("txApp"); if (app) app.addEventListener("click", () => touch());
    loadContacts(); loadTexts();
    setInterval(() => { loadTexts(); }, 3000);
})();
