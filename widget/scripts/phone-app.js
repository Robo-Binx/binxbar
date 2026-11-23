// Binxbar PHONE app: a keypad that also searches your contacts as you dial (2 = ABC, 3 = DEF ...),
// an A-Z strip to browse, and one tap to call through Phone Link on this PC.
// Contacts come from resources/contacts.json (made from your Google Contacts export; it stays on your PC).
// Calls go to a tiny helper on this PC only (phone-server.ps1, 127.0.0.1) that needs a token only Binxbar can read.
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const PORT = 47811, WAKE_KEY = 23;
    const T9 = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 };
    const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
    let focusSearch = false;
    let contacts = [], typed = "", letter = "", backTimer = null, pick = null, statusTimer = null, tab = "keypad", inCall = false, callTimer = null, callWho = null, callStart = 0, tick = null, dialing = false, dialAt = 0, sawCall = false, endedSince = -1, lastSince = 0, ending = false, endingTimer = null;

    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const digits = s => String(s).replace(/\D/g, "");
    const t9 = s => String(s).toLowerCase().replace(/[a-z]/g, ch => T9[ch]).replace(/[^\d ]/g, "");
    const pretty = n => { const d = digits(n); const m = d.match(/^1?(\d{3})(\d{3})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n; };
    const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

    // ---- your lists (kept on this PC in Binxbar's own storage) ----
    const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem("binxbar.phone." + k)); return v == null ? d : v; } catch (e) { return d; } },
                    set(k, v) { try { localStorage.setItem("binxbar.phone." + k, JSON.stringify(v)); } catch (e) {} } };
    let favs = store.get("favs", null), alerts = store.get("alerts", null), recent = store.get("recent", []);
    const norm = n => String(n || "").toLowerCase().trim();
    function isFav(c) { return favs ? favs.includes(norm(c.n)) : !!c.f; }
    function toggleFav(c) { if (!favs) favs = contacts.filter(x => x.f).map(x => norm(x.n)); const k = norm(c.n); favs = favs.includes(k) ? favs.filter(x => x !== k) : [...favs, k]; store.set("favs", favs); }
    function isAlertName(name) { const n = norm(name); if (!n || !alerts) return !alerts; return alerts.some(a => a && (n === a || n.includes(a) || a.includes(n))); }
    function toggleAlert(c) { alerts = alerts || []; const k = norm(c.n); alerts = alerts.includes(k) ? alerts.filter(x => x !== k) : [...alerts, k]; store.set("alerts", alerts); }
    if (!alerts) fetch("resources/phone-alerts.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(l => { if (Array.isArray(l) && !alerts) { alerts = l.map(norm); store.set("alerts", alerts); } }).catch(() => {});
    function addRecent(e) { e.t = Date.now(); if (!e.number && e.name) { const c = contacts.find(x => norm(x.n) === norm(e.name)); if (c) e.number = c.p[0].n; }
        recent = [e, ...recent].slice(0, 60); store.set("recent", recent); if (isOpen() && tab === "recent") render(); }
    window.BinxPhone = { isAlert: isAlertName, addRecent };

    function load() {
        fetch("resources/contacts.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : []).then(list => {
            contacts = (Array.isArray(list) ? list : []).map(c => ({ ...c, t9w: t9(c.n).split(" ").filter(Boolean), dd: c.p.map(p => digits(p.n)) }));
            if (isOpen()) render();
        }).catch(() => {});
    }

    function matches() {
        let list = contacts;
        if (typed) {
            const q = digits(typed);
            list = list.filter(c => c.t9w.some(w => w.startsWith(q)) || c.t9w.join("").startsWith(q) || (q.length >= 3 && c.dd.some(d => d.includes(q))));
        }
        if (!typed && !letter) list = [...list.filter(isFav), ...list.filter(c => !isFav(c))];
        return list;
    }

    // ---- calling (through the PC helper) ----
    function token() { return fetch("resources/phone-token.txt?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : ""); }
    function helper(path, params, retried) {
        return token().then(t => fetch(`http://127.0.0.1:${PORT}/${path}?t=${encodeURIComponent(t.trim())}` + (params || ""), { cache: "no-store" }))
            .then(r => r.json())
            .catch(() => {
                if (retried) throw new Error("helper");
                window.Binxbar && window.Binxbar.tapKey(WAKE_KEY);   // starts the helper if it isn't running yet
                return new Promise(res => setTimeout(res, 2500)).then(() => helper(path, params, true));
            });
    }
    // Backup route when iCUE won't let the widget reach the helper: leave the request in the widget's own saved storage
    // (iCUE keeps it in a file on this PC) and press the phone key; the PC script reads it from there.
    function viaKey(path, arg) {
        try { localStorage.setItem("binxbar.phone.req", "BINXREQ|" + path + "|" + (arg || "") + "|" + Date.now() + "|"); } catch (e) { return Promise.reject(e); }
        if (!(window.Binxbar && window.Binxbar.tapKey(WAKE_KEY))) return Promise.reject(new Error("key"));
        return Promise.resolve({ ok: true, via: "key" });
    }
    function act(path, arg) {
        return token().then(t => fetch(`http://127.0.0.1:${PORT}/${path}?t=${encodeURIComponent(t.trim())}` + (arg ? "&n=" + encodeURIComponent(arg) : ""), { cache: "no-store" }))
            .then(r => r.json()).catch(() => viaKey(path, arg));
    }
    function status(msg, ms) {
        const s = $("phStatus"); if (!s) return;
        s.textContent = msg; s.classList.add("on");
        clearTimeout(statusTimer); if (ms) statusTimer = setTimeout(() => s.classList.remove("on"), ms);
    }
    function call(number, name) {
        pick = null; render();
        status("CALLING " + (name ? name.toUpperCase() : pretty(number)) + " …", 8000);
        act("dial", number).then(j => {
            if (!j || !j.ok) { status("COULDN'T START THE CALL", 5000); return; }
            // Show the call screen as DIALING; the timer starts once Phone Link actually has the call going (see watchCall).
            inCall = true; dialing = true; callWho = { name: name || "", number }; callStart = 0; dialAt = Date.now(); typed = "";
            addRecent({ kind: "out", name: name || "", number });
            clearTimeout(callTimer); callTimer = setTimeout(() => endCall(false), 3 * 3600000);
            clearInterval(tick); tick = setInterval(() => { const t = $("phTimer"); if (t) t.textContent = callStart ? elapsed() : ""; }, 1000);
            render();
        }).catch(() => status("COULDN'T REACH THE PHONE HELPER", 6000));
    }

    function elapsed() { const s = Math.floor((Date.now() - callStart) / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
    function endCall(send) {
        if (send) {   // keep the call screen up (HANGING UP …) until Phone Link really ends the call, so both happen together
            act("hangup").catch(() => {}); ending = true; if (isOpen()) render();
            clearTimeout(endingTimer); endingTimer = setTimeout(() => { if (ending) endCall(false); }, 20000);
            return;
        }
        ending = false; clearTimeout(endingTimer);
        endedSince = lastSince;   // don't let the same call pull the screen back up while Phone Link catches up
        inCall = false; dialing = false; sawCall = false; callWho = null; clearInterval(tick); clearTimeout(callTimer); if (isOpen()) render();
    }
    // The PC helper writes resources/call.json when Phone Link's call window opens and closes.
    function watchCall() {
        fetch("resources/call.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j) return;
            if (j.active) lastSince = j.since || 0;
            if (j.active && j.since === endedSince) return;   // the call you just ended
            if (j.active && Date.now() - (j.since || 0) > 4 * 3600000) return;   // stale
            if (j.active) {
                if (!inCall) {   // a call we didn't dial here (answered on Binxbar, the phone or the PC)
                    let w = { name: "", number: "" };
                    try { const pj = window.BinxPhoneLast; if (pj && pj.kind === "call" && Date.now() - pj.t < 5 * 60000 && !/^\{/.test(pj.who || "")) w.name = pj.who; } catch (e) {}
                    inCall = true; callWho = w; clearInterval(tick); tick = setInterval(() => { const t = $("phTimer"); if (t) t.textContent = callStart ? elapsed() : ""; }, 1000);
                }
                if (!sawCall) { sawCall = true; dialing = false; callStart = j.since || Date.now(); $("widget").dataset.view = "phone"; render(); }
            } else if (inCall && (sawCall || Date.now() - dialAt > 90000)) { endCall(false); status("CALL ENDED", 2500); setTimeout(() => { if (!inCall) close(); }, 2500); }   // call ended (or never got going)
        }).catch(() => {});
    }
    setInterval(watchCall, 1500);
    // The call screen: who you're calling, a timer, and one big END CALL.
    function callPage() {
        const body = el("div", "ph-callscr");
        const w = callWho || { name: "", number: "" };
        body.append(el("div", "ph-cs-state" + (ending ? " ending" : ""), ending ? "HANGING UP …" : dialing ? "DIALING …" : "ON A CALL"));
        body.append(el("div", "ph-cs-name", w.name || pretty(w.number)));
        if (w.name) body.append(el("div", "ph-cs-num", pretty(w.number)));
        const t = el("div", "ph-cs-timer", callStart ? elapsed() : ""); t.id = "phTimer"; body.append(t);
        const end = el("span", "ph-cs-end");
        end.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 9c-2.6 0-5.1.5-7.4 1.5-.7.3-1.1 1-1.1 1.7v2.6c0 .8.8 1.4 1.6 1.2l3.2-.8c.6-.2 1-.7 1-1.3v-1.6c1.8-.5 3.6-.5 5.4 0v1.6c0 .6.4 1.1 1 1.3l3.2.8c.8.2 1.6-.4 1.6-1.2v-2.6c0-.7-.4-1.4-1.1-1.7C17.1 9.5 14.6 9 12 9z"/></svg><span>END CALL</span>';
        end.addEventListener("click", ev => { ev.stopPropagation(); status("HANGING UP …", 2500); endCall(true); });
        body.append(end);
        const hint = el("span", "fc-btn ph-cs-back", "HIDE");
        hint.addEventListener("click", ev => { ev.stopPropagation(); close(); });
        body.append(hint);
        return body;
    }

    // ---- view ----
    function isOpen() { return $("widget").dataset.view === "phone"; }
    function touch() { clearTimeout(backTimer); if (!inCall) backTimer = setTimeout(close, 90000); }
    function open() { if (!inCall) { typed = ""; letter = ""; pick = null; tab = "keypad"; } $("widget").dataset.view = "phone"; touch(); render(); load(); }
    function close() { clearTimeout(backTimer); if (isOpen()) $("widget").dataset.view = "now"; }

    function press(k) {
        touch(); pick = null;
        if (typed.length < 20) typed += k;
        render();
    }

    function backSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4.5" y2="12"></line><polyline points="10.5 5.5 4 12 10.5 18.5"></polyline></svg>'; }
    const PHONE_SVG = '<svg viewBox="0 0 24 24"><path d="M6.6 3.5l2.6-.4 1.6 4.1-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4.1 1.6-.4 2.6a2 2 0 0 1-2.1 1.7C10.6 18.6 5.4 13.4 4.9 5.6a2 2 0 0 1 1.7-2.1z"/></svg>';

    function nav() {
        const bar = el("div", "fc-nav ph-nav");
        const back = el("span", "fc-btn fc-arrow"); back.setAttribute("aria-label", "Back"); back.innerHTML = backSvg();
        back.addEventListener("click", ev => { ev.stopPropagation(); close(); });
        const tabs = el("div", "fc-tabs");
        [["recent", "RECENT"], ["keypad", "KEYPAD"], ["contacts", "CONTACTS"], ["messages", "MESSAGES"]].forEach(([v, label]) => {
            const t = el("span", "fc-btn fc-tab" + (tab === v ? " on" : ""), label);
            t.addEventListener("click", ev => {
                ev.stopPropagation(); touch();
                if (v === "messages") { status("OPENING MESSAGES ON THE RIGHT …", 3000); act("messages").catch(() => status("COULDN'T REACH THE PHONE HELPER", 5000)); return; }
                tab = v; pick = null; focusSearch = v === "contacts"; render(); focusSearch = false;
            });
            tabs.append(t);
        });
        bar.append(back, tabs);
        return bar;
    }

    function contactRow(c, cls) {
        const row = el("div", cls + (isFav(c) ? " fav" : "")); row.dataset.l = c.n.charAt(0).toUpperCase();
        row.append(el("div", "ph-name", c.n), el("div", "ph-sub", c.p.length > 1 ? c.p.length + " NUMBERS" : pretty(c.p[0].n)));
        if (cls === "ph-card") {   // ★ = favorite (top of the list), bell = their texts pop up on Binxbar
            const fav = el("span", "ph-tog ph-tog-fav" + (isFav(c) ? " on" : ""), "★"); fav.title = "Favorite";
            fav.addEventListener("click", ev => { ev.stopPropagation(); touch(); toggleFav(c); render(); });
            const bell = el("span", "ph-tog ph-tog-bell" + (isAlertName(c.n) && alerts ? " on" : ""));
            bell.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';
            bell.addEventListener("click", ev => { ev.stopPropagation(); touch(); toggleAlert(c); render(); status(isAlertName(c.n) ? c.n.toUpperCase() + "'S TEXTS WILL POP UP" : c.n.toUpperCase() + "'S TEXTS STAY QUIET", 2500); });
            row.append(fav, bell);
        }
        if (pick === c) {
            const opts = el("div", "ph-opts");
            c.p.forEach(p => {
                const o = el("span", "fc-btn ph-opt", p.l.toUpperCase() + " · " + pretty(p.n));
                o.addEventListener("click", ev => { ev.stopPropagation(); call(p.n, c.n); });
                opts.append(o);
            });
            row.append(opts);
        }
        row.addEventListener("click", ev => { ev.stopPropagation(); touch(); if (c.p.length === 1) call(c.p[0].n, c.n); else { pick = pick === c ? null : c; render(); } });
        return row;
    }

    function keypad() {
        const body = el("div", "ph-kp");
        // left: what you've typed, and the contacts it matches
        const info = el("div", "ph-kp-info");
        const num = el("div", "ph-num" + (typed ? "" : " empty"), typed ? (digits(typed).length >= 7 ? pretty(typed) : typed) : "TYPE A NUMBER OR A NAME");
        info.append(num);
        if (typed) {
            const sug = el("div", "ph-sug");
            const m = matches().slice(0, 3);
            if (m.length) m.forEach(c => sug.append(contactRow(c, "ph-chip")));
            else sug.append(el("div", "ph-hint", "NO CONTACT MATCHES"));
            info.append(sug);
        } else info.append(el("div", "ph-hint", "KEYS SPELL NAMES TOO — 5 6 4 6 FINDS JOHN"));
        // middle: the keys
        const pad = el("div", "ph-pad");
        KEYS.forEach(([k, sub]) => {
            const b = el("span", "ph-key"); b.append(el("b", null, k), el("small", null, sub));
            b.addEventListener("click", ev => { ev.stopPropagation(); press(k); });
            pad.append(b);
        });
        // right: call + delete
        const side = el("div", "ph-kp-side");
        const callBtn = el("span", "ph-call" + (digits(typed).length >= 3 ? "" : " off")); callBtn.innerHTML = PHONE_SVG;
        callBtn.addEventListener("click", ev => { ev.stopPropagation(); touch(); if (digits(typed).length >= 3) call(typed); });
        const del = el("span", "ph-del" + (typed ? "" : " off"));
        del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H8l-6 7 6 7h13z"/><line x1="17" y1="9" x2="11" y2="15"/><line x1="11" y1="9" x2="17" y2="15"/></svg>';
        del.addEventListener("click", ev => { ev.stopPropagation(); touch(); typed = typed.slice(0, -1); render(); });
        side.append(callBtn, del);
        body.append(info, pad, side);
        return body;
    }

    function contactsPage() {
        // A real search box: tap it and type (keyboard, or Windows' touch keyboard). Matches any part of a first or last name.
        const body = el("div", "ph-ct");
        const bar = el("label", "ph-field");
        bar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="21" y2="21"/></svg>';
        const input = document.createElement("input");
        input.type = "search"; input.className = "ph-input"; input.placeholder = "SEARCH CONTACTS"; input.value = letter;
        input.setAttribute("autocomplete", "off"); input.setAttribute("spellcheck", "false"); input.setAttribute("inputmode", "search");
        const clr = el("span", "fc-btn ph-sbtn" + (letter ? "" : " off"), "CLEAR");
        bar.append(input);
        const head = el("div", "ph-search"); head.append(bar, clr);
        const grid = el("div", "ph-grid");
        const fill = () => {
            grid.textContent = "";
            const q = letter.toLowerCase().trim();
            const list = q ? contacts.filter(c => { const n = c.n.toLowerCase(); return n.split(/\s+/).some(w => w.startsWith(q)) || n.includes(q) || (q.replace(/\D/g, "").length >= 3 && c.dd.some(d => d.includes(q.replace(/\D/g, "")))); })
                           : [...contacts.filter(isFav), ...contacts.filter(c => !isFav(c))];
            grid.append(el("div", "ph-hint ph-count", q ? list.length + (list.length === 1 ? " MATCH" : " MATCHES") : "★ FAVORITES FIRST · " + contacts.length + " CONTACTS"));
            if (!contacts.length) grid.append(el("div", "ph-hint", "NO CONTACTS YET"));
            else if (!list.length) grid.append(el("div", "ph-hint", "NOBODY MATCHES “" + letter + "”"));
            list.slice(0, 150).forEach(c => grid.append(contactRow(c, "ph-card")));
            clr.classList.toggle("off", !letter);
        };
        input.addEventListener("input", () => { touch(); pick = null; letter = input.value.slice(0, 40); fill(); });
        input.addEventListener("click", ev => ev.stopPropagation());
        input.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Escape") { letter = ""; input.value = ""; fill(); } });
        clr.addEventListener("click", ev => { ev.stopPropagation(); touch(); pick = null; letter = ""; input.value = ""; fill(); input.focus(); });
        // A-Z: jump down the list to that letter
        const az = el("div", "ph-az");
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(L => {
            const b = el("span", "ph-l", L);
            b.addEventListener("click", ev => {
                ev.stopPropagation(); touch();
                if (letter) { letter = ""; input.value = ""; fill(); }
                const target = [...grid.querySelectorAll(".ph-card")].find(r => !r.classList.contains("fav") && r.dataset.l >= L);
                if (target) grid.scrollTop = target.offsetTop - 4;
            });
            az.append(b);
        });
        fill();
        body.append(head, az, grid);
        if (focusSearch) setTimeout(() => { try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} }, 30);
        return body;
    }

    function ago(t) { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return "NOW"; if (m < 60) return m + " MIN AGO";
        const d = new Date(t), today = new Date(); const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        if (d.toDateString() === today.toDateString()) return "TODAY " + time; const y = new Date(today); y.setDate(today.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return "YESTERDAY " + time; return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase() + " " + time; }
    function recentPage() {
        const body = el("div", "ph-ct"), list = el("div", "ph-grid ph-recent");
        if (!recent.length) list.append(el("div", "ph-hint", "NO CALLS YET. CALLS YOU MAKE HERE, AND CALLS THAT COME IN, SHOW UP HERE."));
        recent.forEach(e => {
            const row = el("div", "ph-card ph-rc " + e.kind);
            const icon = el("span", "ph-rc-ic", e.kind === "out" ? "↗" : e.kind === "missed" ? "✕" : "↙");
            const name = e.name || (e.number ? pretty(e.number) : "UNKNOWN CALLER");
            row.append(icon, el("div", "ph-name", name), el("div", "ph-sub", (e.kind === "out" ? "OUTGOING · " : e.kind === "missed" ? "MISSED · " : "INCOMING · ") + ago(e.t)));
            if (e.number) row.addEventListener("click", ev => { ev.stopPropagation(); touch(); call(e.number, e.name); });
            list.append(row);
        });
        body.append(list); return body;
    }

    function render() {
        const box = $("phApp"); if (!box) return;
        const keepScroll = box.querySelector(".ph-grid") ? box.querySelector(".ph-grid").scrollTop : 0;
        box.textContent = "";
        if (inCall) box.append(callPage());
        else box.append(nav(), tab === "contacts" ? contactsPage() : tab === "recent" ? recentPage() : keypad());
        const st = el("div", "ph-status"); st.id = "phStatus"; box.append(st);
        const g = box.querySelector(".ph-grid"); if (g && pick) g.scrollTop = keepScroll;
    }

    // Physical keyboard on the KEYPAD page: digits/* /# type, Backspace deletes, Enter calls, Esc closes.
    document.addEventListener("keydown", ev => {
        if (!isOpen() || inCall || tab !== "keypad") return;
        if (ev.target && ev.target.tagName === "INPUT") return;
        const k = ev.key;
        if (/^[0-9*#+]$/.test(k)) { ev.preventDefault(); press(k); }
        else if (k === "Backspace") { ev.preventDefault(); touch(); typed = typed.slice(0, -1); render(); }
        else if (k === "Enter") { ev.preventDefault(); touch(); if (digits(typed).length >= 3) { const m = matches(); call(typed, m.length === 1 && m[0].dd.some(d => d.endsWith(digits(typed).slice(-7))) ? m[0].n : ""); } }
        else if (k === "Escape") { close(); }
    });
    const icon = $("qkPhone");
    if (icon) icon.addEventListener("click", ev => { ev.stopPropagation(); open(); });
    const app = $("phApp");
    if (app) app.addEventListener("click", () => touch());
    load();
    setInterval(load, 10 * 60000);
})();
