// Calendar module: tap the date to open a month grid + that day's events.
// Events come from a Google Calendar "secret address in iCal format" pasted into the widget settings.
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const setting = (name, fallback) => (typeof window[name] !== "undefined" && window[name] !== null && window[name] !== "" ? window[name] : fallback);
    const MON = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const DOW = ["S", "M", "T", "W", "T", "F", "S"];
    const REFRESH_MS = 10 * 60 * 1000;

    let events = [], status = "none", lastUrl = null, timer = 0, backTimer = 0;
    let shown = new Date(), selected = new Date();

    const key = d => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const sameDay = (a, b) => key(a) === key(b);
    function el(tag, cls, text) { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; }

    // ---- Minimal iCal parsing (VEVENT, all-day, TZID-as-local, UTC, simple RRULE, EXDATE) ----
    function parseDate(value, params) {
        const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
        if (!m) return null;
        const allDay = !m[4] || /VALUE=DATE(?!-)/.test(params || "");
        if (allDay) return { d: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
        if (m[7]) return { d: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])), allDay: false };
        return { d: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), allDay: false };
    }

    function parseIcs(text) {
        const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
        const out = [];
        let cur = null;
        for (const line of lines) {
            if (line === "BEGIN:VEVENT") { cur = { exdates: [] }; continue; }
            if (line === "END:VEVENT") { if (cur && cur.start) out.push(cur); cur = null; continue; }
            if (!cur) continue;
            const i = line.indexOf(":"); if (i < 0) continue;
            const left = line.slice(0, i), value = line.slice(i + 1);
            const [name, ...p] = left.split(";"); const params = p.join(";");
            if (name === "SUMMARY") cur.title = value.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").trim();
            else if (name === "DTSTART") { const r = parseDate(value, params); if (r) { cur.start = r.d; cur.allDay = r.allDay; } }
            else if (name === "DTEND") { const r = parseDate(value, params); if (r) cur.end = r.d; }
            else if (name === "RRULE") cur.rrule = value;
            else if (name === "EXDATE") value.split(",").forEach(v => { const r = parseDate(v, params); if (r) cur.exdates.push(key(r.d)); });
            else if (name === "STATUS" && value === "CANCELLED") cur.cancelled = true;
        }
        return out.filter(e => !e.cancelled);
    }

    // Expand events into concrete occurrences between from and to.
    function expand(list, from, to) {
        const occ = [];
        const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
        for (const e of list) {
            const dur = e.end ? e.end - e.start : (e.allDay ? 86400000 : 3600000);
            const push = s => { if (s >= from && s < to && !e.exdates.includes(key(s))) occ.push({ title: e.title || "(No title)", start: s, end: new Date(+s + dur), allDay: e.allDay }); };
            if (!e.rrule) { push(e.start); continue; }
            const r = Object.fromEntries(e.rrule.split(";").map(kv => kv.split("=")));
            const interval = +(r.INTERVAL || 1);
            const until = r.UNTIL ? (parseDate(r.UNTIL) || {}).d : null;
            let count = r.COUNT ? +r.COUNT : Infinity;
            const days = r.BYDAY ? r.BYDAY.split(",").map(d => BYDAY[d.slice(-2)]).filter(d => d !== undefined) : null;
            let cursor = new Date(e.start), guard = 0;
            while (count > 0 && guard++ < 2000) {
                if (until && cursor > until) break;
                if (cursor >= to) break;
                if (r.FREQ === "WEEKLY" && days && days.length) {
                    const weekStart = new Date(cursor); weekStart.setDate(cursor.getDate() - cursor.getDay());
                    for (const wd of days.slice().sort()) {
                        const s = new Date(weekStart); s.setDate(weekStart.getDate() + wd);
                        s.setHours(e.start.getHours(), e.start.getMinutes(), e.start.getSeconds());
                        if (s < e.start || (until && s > until) || count <= 0) continue;
                        push(s); count--;
                    }
                    cursor.setDate(cursor.getDate() + 7 * interval);
                } else {
                    push(new Date(cursor)); count--;
                    if (r.FREQ === "DAILY") cursor.setDate(cursor.getDate() + interval);
                    else if (r.FREQ === "WEEKLY") cursor.setDate(cursor.getDate() + 7 * interval);
                    else if (r.FREQ === "MONTHLY") cursor.setMonth(cursor.getMonth() + interval);
                    else if (r.FREQ === "YEARLY") cursor.setFullYear(cursor.getFullYear() + interval);
                    else break;
                }
            }
        }
        return occ.sort((a, b) => a.start - b.start);
    }

    async function load() {
        clearTimeout(timer);
        const url = String(setting("calendarUrl", "")).trim();
        if (!url) { events = []; status = "none"; render(); return; }
        try {
            const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
            const r = await fetch(url.replace(/^webcal:/i, "https:"), { cache: "no-store", signal: ctl.signal });
            clearTimeout(t);
            if (!r.ok) throw new Error("HTTP " + r.status);
            events = parseIcs(await r.text()); status = "ok";
        } catch (e) { status = events.length ? "stale" : "error"; }
        render();
        timer = setTimeout(load, REFRESH_MS);
    }

    function dayEvents(d) {
        const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()), to = new Date(from); to.setDate(to.getDate() + 1);
        return expand(events, from, to).concat(
            // multi-day events that started earlier
            expand(events, new Date(+from - 30 * 86400000), from).filter(o => o.end > from)
        ).sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
    }

    function render() {
        const box = $("cal"); if (!box) return;
        box.replaceChildren();
        const y = shown.getFullYear(), m = shown.getMonth();
        const first = new Date(y, m, 1), start = new Date(first); start.setDate(1 - first.getDay());
        const monthEnd = new Date(y, m + 1, 1);
        const busy = new Set(expand(events, start, new Date(+start + 42 * 86400000)).map(o => key(o.start)));

        const left = el("div", "cal-left");
        const head = el("div", "cal-head");
        const prev = el("span", "cal-nav", "◂"), next = el("span", "cal-nav", "▸");
        const title = el("span", "cal-title", MON[m] + " " + y);
        prev.addEventListener("click", ev => { ev.stopPropagation(); shown = new Date(y, m - 1, 1); touch(); render(); });
        next.addEventListener("click", ev => { ev.stopPropagation(); shown = new Date(y, m + 1, 1); touch(); render(); });
        title.addEventListener("click", ev => { ev.stopPropagation(); close(); });
        head.append(prev, title, next);
        const grid = el("div", "cal-grid");
        DOW.forEach(d => grid.append(el("span", "cal-dow", d)));
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const d = new Date(start); d.setDate(start.getDate() + i);
            const c = el("span", "cal-day", String(d.getDate()));
            if (d.getMonth() !== m) c.classList.add("out");
            if (sameDay(d, today)) c.classList.add("today");
            if (sameDay(d, selected)) c.classList.add("sel");
            if (busy.has(key(d))) c.classList.add("busy");
            c.addEventListener("click", ev => { ev.stopPropagation(); selected = d; if (d.getMonth() !== m) shown = new Date(d.getFullYear(), d.getMonth(), 1); touch(); render(); });
            grid.append(c);
            if (i >= 34 && d >= monthEnd && d.getDay() === 6) break; // drop an empty 6th row
        }
        left.append(head, grid);

        const right = el("div", "cal-right");
        const label = sameDay(selected, today) ? "TODAY" : selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
        const rhead = el("div", "cal-rhead");
        const back = el("span", "fc-btn fc-arrow"); back.setAttribute("aria-label", "Back"); back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4.5" y2="12"></line><polyline points="10.5 5.5 4 12 10.5 18.5"></polyline></svg>';
        back.addEventListener("click", ev => { ev.stopPropagation(); close(); });
        rhead.append(el("div", "cal-agenda-title", label), back);
        right.append(rhead);
        const list = el("div", "cal-list");
        if (status === "none") list.append(el("div", "cal-note", "Add your Google Calendar iCal link in iCUE to see events."));
        else if (status === "error") list.append(el("div", "cal-note", "Couldn't load your calendar."));
        else {
            const evs = dayEvents(selected);
            if (!evs.length) list.append(el("div", "cal-note", "Nothing scheduled."));
            evs.slice(0, 5).forEach(o => {
                const row = el("div", "cal-ev");
                const t = o.allDay ? "ALL DAY" : o.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                row.append(el("span", "cal-ev-time", t), el("span", "cal-ev-title", o.title));
                list.append(row);
            });
            if (evs.length > 5) list.append(el("div", "cal-note", "+" + (evs.length - 5) + " more"));
            if (status === "stale") list.append(el("div", "cal-note", "Offline: showing last sync."));
        }
        right.append(list);
        box.append(left, right);
    }

    function touch() { clearTimeout(backTimer); backTimer = setTimeout(close, 45000); }
    function open() { shown = new Date(); selected = new Date(); $("widget").dataset.view = "calendar"; touch(); render(); }
    function close() { clearTimeout(backTimer); $("widget").dataset.view = "now"; }

    $("date").addEventListener("click", ev => { ev.stopPropagation(); open(); });
    $("cal").addEventListener("click", () => touch());

    function check() {
        const url = String(setting("calendarUrl", "")).trim();
        if (url !== lastUrl) { lastUrl = url; load(); }
    }
    check();
    setInterval(check, 1000);
})();
