// Current weather for the Clock and Date widget (Open-Meteo, no API key).
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const setting = (name, fallback) => (typeof window[name] !== "undefined" && window[name] !== null && window[name] !== "" ? window[name] : fallback);
    const REFRESH_MS = 15 * 60 * 1000;
    const RETRY_MS = 2 * 60 * 1000;
    const CACHE_KEY = "clockdate-weather-v1";

    let geo = null, geoFor = "", timer = 0, lastKey = "";

    function on(value) { return value === true || value === "true"; }

    function cond(code) {
        if (code === 0) return "CLEAR";
        if (code <= 2) return "PARTLY CLOUDY";
        if (code === 3) return "OVERCAST";
        if (code === 45 || code === 48) return "FOG";
        if (code >= 51 && code <= 57) return "DRIZZLE";
        if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "RAIN";
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "SNOW";
        if (code >= 95) return "STORM";
        return "--";
    }

    async function getJson(url) {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 12000);
        try {
            const r = await fetch(url, { cache: "no-store", signal: ctl.signal });
            if (!r.ok) throw new Error("HTTP " + r.status);
            return await r.json();
        } finally { clearTimeout(t); }
    }

    // "Springfield, Illinois" -> best matching place (region match first, then largest population).
    const US = { AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",DE:"delaware",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",NH:"new hampshire",NJ:"new jersey",NM:"new mexico",NY:"new york",NC:"north carolina",ND:"north dakota",OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode island",SC:"south carolina",SD:"south dakota",TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west virginia",WI:"wisconsin",WY:"wyoming" };
    async function locate(city) {
        const parts = city.split(",").map(s => s.trim()).filter(Boolean);
        const name = parts[0] || city;
        let region = (parts[1] || "").toLowerCase();
        if (US[region.toUpperCase()]) region = US[region.toUpperCase()];
        const data = await getJson("https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" + encodeURIComponent(name));
        const list = (data && data.results) || [];
        if (!list.length) throw new Error("city_not_found");
        let pick = null;
        if (region) {
            pick = list.find(p => [p.admin1, p.country, p.country_code].some(v => v && String(v).toLowerCase().startsWith(region)));
        }
        if (!pick) pick = list.slice().sort((a, b) => (b.population || 0) - (a.population || 0))[0];
        return { lat: pick.latitude, lon: pick.longitude, label: pick.name };
    }

    // Temperature color by feel (in F), condition color by type.
    // Muted temperature palette (stops in F): icy blue -> steel blue -> cool slate -> wheat -> sand -> amber -> terracotta -> brick.
    const STOPS = [[5, [150, 172, 222]], [25, [126, 162, 212]], [38, [112, 166, 198]], [48, [130, 172, 180]], [57, [196, 192, 164]],
                   [65, [222, 198, 146]], [73, [228, 178, 112]], [81, [222, 148, 96]], [89, [210, 114, 86]], [98, [196, 86, 80]], [108, [178, 70, 92]]];
    function soft(rgb) { return "rgb(" + rgb.map(Math.round).join(",") + ")"; }
    function tempColor(t, unit) {
        const f = unit === "C" ? t * 9 / 5 + 32 : t;
        if (f <= STOPS[0][0]) return soft(STOPS[0][1]);
        for (let i = 1; i < STOPS.length; i++) {
            if (f <= STOPS[i][0]) {
                const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (f - a) / (b - a);
                return soft(ca.map((v, j) => v + (cb[j] - v) * k));
            }
        }
        return soft(STOPS[STOPS.length - 1][1]);
    }
    function condColor() { return "#cfcbc4"; } // conditions stay neutral; color only means temperature

    function hiLo(target, hi, lo, unit, prefix) {
        target.replaceChildren();
        if (prefix) target.append(document.createTextNode(prefix));
        const h = document.createElement("span"); h.textContent = "H " + Math.round(hi) + "\u00b0"; h.style.color = tempColor(hi, unit);
        const l = document.createElement("span"); l.textContent = "L " + Math.round(lo) + "\u00b0"; l.style.color = tempColor(lo, unit);
        target.append(h, document.createTextNode("  "), l);
    }

    function render(w, stale) {
        const unit = w.unit === "C" ? "C" : "F";
        const root = $("widget");
        root.style.setProperty("--wx-temp-color", tempColor(w.temp, unit));
        root.style.setProperty("--wx-cond-color", condColor(w.code));
        $("wxTemp").textContent = Math.round(w.temp) + "°" + unit;
        $("wxCond").textContent = cond(w.code);
        hiLo($("wxHL"), w.hi, w.lo, unit);
        $("wxCity").textContent = (w.label || "").toUpperCase();
        if (stale) $("wxCity").textContent += "  // OFFLINE";
        lastW = w;
        renderForecast();
    }

    // ---- Forecast views: now -> today hourly -> 7 days -> 14 days -> now.
    //      Tap a day in the 7/14-day view to see that day hourly; tap the hourly view to go back.
    let view = "now", lastW = null, backTimer = 0, hourDay = 0, hourFrom = "now";
    // A searched place (null = your home city from settings). Forecast tabs and radar follow it.
    let place = null, placeW = null;
    const fw = () => place ? placeW : lastW;
    const homePlace = () => lastW && lastW.lat !== undefined ? { lat: lastW.lat, lon: lastW.lon, label: lastW.label, sub: "HOME" } : (geo ? { lat: geo.lat, lon: geo.lon, label: geo.label, sub: "HOME" } : null);
    const curPlace = () => place || homePlace();
    function choose(p) {
        const h = homePlace();
        if (!p || (h && Math.abs(p.lat - h.lat) < 0.01 && Math.abs(p.lon - h.lon) < 0.01)) { place = null; placeW = null; renderForecast(); return; }
        place = p; placeW = null; renderForecast();
        const unit = setting("weatherUnits", "F") === "C" ? "C" : "F";
        fetchW({ lat: p.lat, lon: p.lon, label: p.label }, unit).then(w => { if (place === p) { placeW = w; renderForecast(); } }).catch(() => {});
    }
    const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    function el(tag, cls, text) { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function navBar() {
        const bar = el("div", "fc-nav");
        const back = el("span", "fc-btn fc-arrow"); back.setAttribute("aria-label", "Back"); back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="12" x2="4.5" y2="12"></line><polyline points="10.5 5.5 4 12 10.5 18.5"></polyline></svg>';
        back.addEventListener("click", ev => { ev.stopPropagation(); setView("now"); });
        bar.append(back);
        const tabs = el("div", "fc-tabs");
        [["hourly", "HOURLY"], ["week", "7-DAY"], ["fortnight", "14-DAY"], ["radar", "RADAR"]].forEach(([v, label]) => {
            const t = el("span", "fc-btn fc-tab" + (view === v ? " on" : ""), label);
            t.addEventListener("click", ev => { ev.stopPropagation(); if (v === "hourly") openHourly(view === "hourly" ? hourDay : 0, view === "hourly" ? hourFrom : "now"); else setView(v); });
            tabs.append(t);
        });
        bar.append(tabs);
        // Where you're looking: tap to search anywhere; the x goes back home.
        const cp = curPlace();
        const where = el("span", "fc-btn fc-where" + (place ? " away" : ""));
        where.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
        where.append(document.createTextNode(cp ? String(cp.label).toUpperCase() : "SEARCH"));
        where.addEventListener("click", ev => { ev.stopPropagation(); bump(); window.BinxSearch && window.BinxSearch.open(p => { choose(p); bump(); }, homePlace()); });
        bar.append(where);
        if (place) { const x = el("span", "fc-btn fc-home", "HOME"); x.addEventListener("click", ev => { ev.stopPropagation(); choose(null); }); bar.append(x); }
        return bar;
    }
    // Small condition icons in natural, muted colors.
    function icon(code) {
        const SUN = '<g stroke="#e6c873"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';
        const CLOUD = (y) => '<path stroke="#bfbcb6" d="M7 ' + (17 + y) + 'h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.2 10.6 3.3 3.3 0 0 0 7 ' + (17 + y) + 'z"/>';
        const SMALLSUN = '<g stroke="#e6c873"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/></g>';
        const DROPS = '<path stroke="#7fb2e0" d="M8.5 19.5l-1 2M12.5 19.5l-1 2M16.5 19.5l-1 2"/>';
        const FLAKES = '<g stroke="#e8eef5"><path d="M8.5 20.5h.01M12.5 21.5h.01M16.5 20.5h.01"/></g>';
        const BOLT = '<path stroke="#e6c873" d="M12.5 17l-2 3h3l-2 3"/>';
        const FOG = '<path stroke="#bfbcb6" d="M4 9h16M6 13h12M4 17h16"/>';
        let g;
        if (code === 0) g = SUN;
        else if (code <= 2) g = SMALLSUN + CLOUD(1);
        else if (code === 3) g = CLOUD(0);
        else if (code === 45 || code === 48) g = FOG;
        else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = CLOUD(-2) + FLAKES;
        else if (code >= 95) g = CLOUD(-2) + BOLT;
        else if (code >= 51) g = CLOUD(-2) + DROPS;
        else g = CLOUD(0);
        const s = document.createElement("span"); s.className = "wx-ic";
        s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + g + '</svg>';
        return s;
    }
    function renderForecast() {
        const box = $("fc");
        if (!box) return;
        if (view === "radar") {
            box.replaceChildren(); box.append(navBar()); box.dataset.mode = "radar";
            const p = curPlace();
            if (p && window.BinxRadar) box.append(window.BinxRadar.show(p));
            return;
        }
        if (window.BinxRadar) window.BinxRadar.hide();
        const lastW = fw();
        if (!lastW || !lastW.days) { if (place) { box.replaceChildren(); box.append(navBar(), el("div", "fc-loading", "LOADING " + String(place.label).toUpperCase() + "\u2026")); } return; }
        box.replaceChildren();
        box.append(navBar());
        if (view === "hourly") return renderHourly(box);
        const days = el("div", "fc-days");
        box.append(days);
        const n = view === "fortnight" ? 14 : 7;
        box.dataset.mode = "days";
        lastW.days.slice(0, n).forEach((d, i) => {
            const cell = el("div", "fc-day");
            cell.style.setProperty("--c-hi", tempColor(d.hi, lastW.unit));
            cell.style.setProperty("--c-cond", condColor(d.code));
            cell.style.setProperty("--c-lo", tempColor(d.lo, lastW.unit));
            const dt = new Date(d.t + "T12:00:00");
            cell.append(el("span", "fc-name", i === 0 ? "TDY" : DAY[dt.getDay()]), icon(d.code), el("span", "fc-bar"),
                        el("span", "fc-hi", Math.round(d.hi) + "\u00b0"), el("span", "fc-lo", Math.round(d.lo) + "\u00b0"));
            cell.addEventListener("click", ev => { ev.stopPropagation(); openHourly(i, view); });
            days.append(cell);
        });
    }
    function renderHourly(box) {
        const lastW = fw();
        box.dataset.mode = "hourly";
        const day = lastW.days[hourDay];
        if (!day) return;
        const hrs = (lastW.hours || []).filter(h => h.t.slice(0, 10) === day.t);
        const dt = new Date(day.t + "T12:00:00");
        const row = el("div", "hr-head");
        const prev = el("span", "fc-btn hr-step" + (hourDay === 0 ? " off" : ""), "\u25C2");
        const next = el("span", "fc-btn hr-step" + (hourDay >= lastW.days.length - 1 ? " off" : ""), "\u25B8");
        prev.addEventListener("click", ev => { ev.stopPropagation(); if (hourDay > 0) openHourly(hourDay - 1, hourFrom); });
        next.addEventListener("click", ev => { ev.stopPropagation(); if (hourDay < lastW.days.length - 1) openHourly(hourDay + 1, hourFrom); });
        const titleEl = el("div", "hr-title");
        hiLo(titleEl, day.hi, day.lo, lastW.unit, (hourDay === 0 ? "TODAY" : DAY[dt.getDay()]) + "  " + MON[dt.getMonth()] + " " + dt.getDate() + "  //  ");
        row.append(prev, titleEl, next);
        box.append(row);
        const strip = el("div", "hr-strip");
        const temps = hrs.map(h => h.temp), min = Math.min(...temps), max = Math.max(...temps), span = Math.max(1, max - min);
        const nowKey = new Date().toISOString().slice(0, 13);
        hrs.forEach((h, i) => {
            const c = el("div", "hr-col");
            const hr = new Date(h.t).getHours();
            c.style.setProperty("--c-t", tempColor(h.temp, lastW.unit));
            c.style.setProperty("--c-cond", condColor(h.code));
            c.style.setProperty("--lvl", String(0.25 + 0.75 * (h.temp - min) / span));
            if (hourDay === 0 && hr === new Date().getHours()) c.classList.add("is-now");
            const ic = icon(h.code); if (i % 2 === 0) ic.classList.add("blank");
            c.append(ic, el("span", "hr-temp", Math.round(h.temp) + "\u00b0"), el("span", "hr-bar"),
                     el("span", "hr-pop", h.pop >= 20 ? h.pop + "%" : ""),
                     el("span", "hr-hour", i % 3 === 0 ? (hr % 12 || 12) + (hr < 12 ? "A" : "P") : ""));
            strip.append(c);
        });
        box.append(strip);
    }
    function openHourly(i, from) { hourDay = i; hourFrom = from; setView("hourly"); }
    function setView(v) {
        view = v;
        $("widget").dataset.view = v;
        if (v === "now") { place = null; placeW = null; if (window.BinxSearch) window.BinxSearch.close(); }
        bump();
        renderForecast();
    }
    // Views close themselves after a while without touches (radar gets longer).
    function bump() { clearTimeout(backTimer); if (view !== "now") backTimer = setTimeout(() => setView("now"), view === "radar" ? 300000 : 60000); }
    $("wx").addEventListener("click", () => openHourly(0, "now"));
    $("fc").addEventListener("click", () => bump());   // any tap keeps it open longer
    $("fc").addEventListener("pointerdown", () => bump());



    async function fetchW(g, unit) {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=" + g.lat + "&longitude=" + g.lon +
            "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=14&timezone=auto" +
            (unit === "F" ? "&temperature_unit=fahrenheit" : "");
        const d = await getJson(url);
        const w = { temp: d.current.temperature_2m, code: d.current.weather_code,
                    hi: d.daily.temperature_2m_max[0], lo: d.daily.temperature_2m_min[0],
                    unit, label: g.label, lat: g.lat, lon: g.lon, at: Date.now(),
                    days: d.daily.time.map((t, i) => ({ t, code: d.daily.weather_code[i], hi: d.daily.temperature_2m_max[i], lo: d.daily.temperature_2m_min[i] })),
                    hours: d.hourly ? d.hourly.time.map((t, i) => ({ t, temp: d.hourly.temperature_2m[i], code: d.hourly.weather_code[i], pop: (d.hourly.precipitation_probability || [])[i] })) : [] };
        return w;
    }

    function cached() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; }
    }

    async function update() {
        clearTimeout(timer);
        const city = String(setting("weatherCity", "New York, NY")).trim();
        const unit = setting("weatherUnits", "F") === "C" ? "C" : "F";
        try {
            if (!geo || geoFor !== city) { geo = await locate(city); geoFor = city; }
            const w = await fetchW(geo, unit);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(w)); } catch (e) {}
            render(w, false);
            timer = setTimeout(update, REFRESH_MS);
        } catch (e) {
            const w = cached();
            if (w) render(w, true);
            else { $("wxTemp").textContent = "--°"; $("wxCond").textContent = "NO SIGNAL"; $("wxHL").textContent = ""; $("wxCity").textContent = city.toUpperCase(); }
            timer = setTimeout(update, RETRY_MS);
        }
    }

    function apply() {
        const show = on(setting("showWeather", true));
        $("widget").classList.toggle("has-wx", show);
        $("wx").hidden = !show;
        const key = show + "|" + setting("weatherCity", "New York, NY") + "|" + setting("weatherUnits", "F");
        if (show && key !== lastKey) { lastKey = key; update(); }
        if (!show) { lastKey = key; clearTimeout(timer); }
    }

    const w = cached();
    if (w) render(w, false);
    // Settings can change at any time; check them once a second (cheap) and refetch only when they differ.
    apply();
    setInterval(apply, 1000);
})();
