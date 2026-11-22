// Radar map + place search for the weather view.
// Radar: RainViewer public API (real radar, last 30 min) + Open-Meteo 15-min precipitation forecast (next 2 h).
// Layers: RAIN, CLOUDS, WIND, PRESSURE, STORMS (Open-Meteo grid across the map).
// Map:   CARTO dark basemap + labels (OpenStreetMap data).
// Search: Open-Meteo geocoding (same provider as the forecast).
(() => {
    "use strict";
    const RV_API = "https://api.rainviewer.com/public/weather-maps.json";
    // CARTO's map tiles need a free key (carto.com/basemaps/apikey). It comes from the widget setting "Map Key"
    // or, failing that, resources/map-key.txt. Without one the map shows CARTO's "API KEY REQUIRED" watermark.
    let mapKey = "";
    try { mapKey = String(window.mapKey || "").trim(); } catch (e) {}
    if (!mapKey) fetch("resources/map-key.txt?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(t => { t = (t || "").trim(); if (t && !mapKey) { mapKey = t; if (R.root) { R.layers.base.textContent = ""; R.layers.labels.textContent = ""; render(); } } }).catch(() => {});
    const CARTO = (layer, z, x, y) => "https://basemaps.cartocdn.com/rastertiles/" + layer + "/" + z + "/" + x + "/" + y + ".png" + (mapKey ? "?key=" + encodeURIComponent(mapKey) : "");
    const MINZ = 6, MAXZ = 10, RADAR_MAXZ = 7, START_Z = 7;   // regional (about New England) down to city level
    const RADAR_PER_MIN = 80;                 // RainViewer allows 100 requests/min/IP; stay under it
    const FRAME_MS = 550, LAST_HOLD_MS = 1800;

    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const stop = ev => ev.stopPropagation();
    const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem("binxbar." + k) || "null"); localStorage.setItem("binxbar." + k, JSON.stringify(v)); } catch (e) { return null; } };

    // ---- Web-mercator helpers (256-px tiles; world is 256 * 2^z px wide) ----
    const lon2x = (lon, z) => (lon + 180) / 360 * 256 * Math.pow(2, z);
    const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); };
    const x2lon = (x, z) => x / (256 * Math.pow(2, z)) * 360 - 180;
    const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (256 * Math.pow(2, z)); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

    // ---- Rate-limited loader for radar tiles (latest frame first) ----
    const queue = []; let sent = [], pumping = 0;
    function want(img, url, prio) { queue.push({ img, url, prio }); queue.sort((a, b) => a.prio - b.prio); if (!pumping) pump(); }
    function pump() {
        pumping = 0;
        const now = Date.now(); sent = sent.filter(t => now - t < 60000);
        while (queue.length && sent.length < RADAR_PER_MIN) {
            const it = queue.shift();
            if (!it.img.isConnected || it.img.dataset.url !== it.url) continue;
            sent.push(now); it.img.src = it.url;
        }
        if (queue.length) pumping = setTimeout(pump, 1500);
    }

    // ---- Weather station layers (Open-Meteo, same provider as the forecast) ----
    // RAIN: real radar for the last 30 min, then 15-minute precipitation FORECAST frames for the next 2 hours.
    // CLOUDS / WIND / PRESSURE / STORMS: current conditions on a grid across the map.
    const LAYERS = [["rain", "RAIN"], ["clouds", "CLOUDS"], ["wind", "WIND"], ["pressure", "PRESSURE"], ["storms", "STORMS"]];
    const PAST_FRAMES = 4;          // 30 min of real radar (10-min steps) for motion
    const FC_STEPS = 8;             // 2 h of forecast in 15-min steps
    const GRID_TTL = 10 * 60000;
    const imperial = () => { try { return String(window.weatherUnits || "F") !== "C"; } catch (e) { return true; } };
    const lerpRGB = (stops, v) => {   // stops: [[value, [r,g,b,a]], ...]
        if (v <= stops[0][0]) return stops[0][1];
        for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
            const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
            return ca.map((c, k) => c + (cb[k] - c) * t);
        }
        return stops[stops.length - 1][1];
    };
    const PRECIP = [[0.05, [136, 221, 238, 0]], [0.3, [136, 221, 238, 150]], [1, [0, 153, 204, 180]], [2.5, [0, 105, 160, 195]],
                    [5, [255, 238, 0, 205]], [10, [255, 170, 0, 210]], [20, [255, 68, 0, 215]], [40, [193, 0, 0, 220]]];
    const CLOUD = [[5, [220, 226, 236, 0]], [100, [220, 226, 236, 165]]];
    const CAPE = [[250, [230, 200, 115, 0]], [700, [230, 200, 115, 110]], [1500, [240, 154, 80, 150]], [2500, [240, 96, 95, 170]], [4000, [200, 90, 210, 185]]];
    const PRESS = [[990, [240, 96, 95, 70]], [1008, [240, 96, 95, 20]], [1013, [0, 0, 0, 0]], [1018, [127, 178, 224, 20]], [1035, [127, 178, 224, 70]]];
    const WINDC = [[0, [127, 178, 224, 255]], [10, [110, 208, 160, 255]], [20, [230, 200, 115, 255]], [30, [240, 154, 80, 255]], [45, [240, 96, 95, 255]]];
    const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const card = d => DIRS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
    const rgba = c => "rgba(" + c.slice(0, 3).map(Math.round).join(",") + "," + (c[3] / 255).toFixed(3) + ")";
    const fmtTime = ms => { const d = new Date(ms); return (d.getHours() % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0") + (d.getHours() < 12 ? " AM" : " PM"); };

    // ---- The map ----
    const R = {
        root: null, place: null, lat: 0, lon: 0, z: START_Z,
        frames: [], host: "", fi: 0, playing: true, anim: 0, refresh: 0,
        layer: "rain", grid: null, gridBusy: false, gridTimer: 0,
        layers: {}, ui: {}
    };
    // Timeline = radar frames (past) + forecast frames (future).
    const fcFrames = () => (R.grid && R.grid.fc) || [];
    const tlLen = () => R.frames.length + fcFrames().length;
    const tlAt = i => i < R.frames.length ? { kind: "radar", time: R.frames[i].time * 1000, f: R.frames[i] } : { kind: "fc", time: fcFrames()[i - R.frames.length].time, k: fcFrames()[i - R.frames.length].k };

    function build() {
        const root = el("div", "rd");
        root.addEventListener("click", stop);
        const map = el("div", "rd-map");
        const base = el("div", "rd-layer"), radar = el("div", "rd-layer rd-radar"), labels = el("div", "rd-layer"), pin = el("div", "rd-pin");
        const wx = el("canvas", "rd-wx");
        map.append(base, radar, wx, labels, pin);
        const tl = el("div", "rd-bar");
        const play = el("span", "fc-btn rd-play"), time = el("span", "rd-time", "LOADING RADAR"), ticks = el("div", "rd-ticks"), read = el("div", "rd-read");
        tl.append(play, time, ticks, read);
        const zoom = el("div", "rd-zoom");
        const zin = el("span", "fc-btn", "+"), zout = el("span", "fc-btn", "−"), home = el("span", "fc-btn rd-ctr", "◎");
        zoom.append(zin, zout, home);
        const credit = el("div", "rd-credit", "Radar RainViewer · Forecast Open-Meteo · Map © CARTO © OpenStreetMap");
        const top = el("div", "rd-top");
        const lyr = el("div", "rd-lyr");
        LAYERS.forEach(([k, label]) => { const b = el("span", "fc-btn rd-lb", label); b.dataset.k = k; b.addEventListener("click", ev => { stop(ev); setLayer(k); }); lyr.append(b); });
        const legend = el("div", "rd-legend");
        top.append(lyr, legend);
        root.append(map, tl, zoom, top, credit);
        R.root = root; R.layers = { base, radar, labels, pin, wx }; R.ui = { map, play, time, ticks, read, legend, lyr, bar: tl };

        play.addEventListener("click", ev => { stop(ev); R.playing = !R.playing; drawPlay(); if (R.playing) tick(); });
        zin.addEventListener("click", ev => { stop(ev); setZoom(R.z + 1); });
        zout.addEventListener("click", ev => { stop(ev); setZoom(R.z - 1); });
        home.addEventListener("click", ev => { stop(ev); if (R.place) { R.lat = R.place.lat; R.lon = R.place.lon; } render(); });

        // Drag to pan, double-tap to zoom in.
        let drag = null, lastTap = 0;
        map.addEventListener("pointerdown", e => { stop(e); drag = { x: e.clientX, y: e.clientY, cx: lon2x(R.lon, R.z), cy: lat2y(R.lat, R.z), moved: false }; try { map.setPointerCapture(e.pointerId); } catch (x) {} });
        map.addEventListener("pointermove", e => {
            if (!drag) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
            if (!drag.moved) return;
            const W = 256 * Math.pow(2, R.z);
            R.lon = x2lon(((drag.cx - dx) % W + W) % W, R.z);
            R.lat = Math.max(-80, Math.min(80, y2lat(drag.cy - dy, R.z)));
            render();
        });
        const end = e => {
            if (!drag) return; stop(e);
            if (!drag.moved) { const now = Date.now(); if (now - lastTap < 350) setZoom(R.z + 1); lastTap = now; }
            drag = null;
        };
        map.addEventListener("pointerup", end); map.addEventListener("pointercancel", end);
        map.addEventListener("click", stop);
        drawPlay();
        R.layer = LAYERS.some(l => l[0] === store("radarLayer")) ? store("radarLayer") : "rain";
        drawLayerUI();
    }
    function drawPlay() { R.ui.play.innerHTML = R.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>'; }
    function setZoom(z) { z = Math.max(MINZ, Math.min(MAXZ, z)); if (z === R.z) return; R.z = z; store("radarZoom", z); render(); }
    function setLayer(k) { R.layer = k; store("radarLayer", k); drawLayerUI(); render(); if (k === "rain") tick(); }
    function drawLayerUI() {
        [...R.ui.lyr.children].forEach(b => b.classList.toggle("on", b.dataset.k === R.layer));
        R.root.dataset.layer = R.layer;
        const imp = imperial();
        const L = {
            rain: ["LIGHT", "linear-gradient(90deg,#88ddee,#0099cc,#0077aa,#ffee00,#ffaa00,#ff4400,#c10000)", "HEAVY"],
            clouds: ["CLEAR", "linear-gradient(90deg,rgba(220,226,236,0),rgba(220,226,236,.75))", "OVERCAST"],
            wind: ["CALM", "linear-gradient(90deg,#7fb2e0,#6ed0a0,#e6c873,#f09a50,#f0605f)", imp ? "45+ MPH" : "70+ KM/H"],
            pressure: ["LOW", "linear-gradient(90deg,rgba(240,96,95,.8),rgba(0,0,0,0),rgba(127,178,224,.8))", "HIGH"],
            storms: ["NONE", "linear-gradient(90deg,rgba(230,200,115,0),#e6c873,#f09a50,#f0605f,#c85ad2)", "SEVERE"]
        }[R.layer];
        R.ui.legend.textContent = ""; const g = el("i"); g.style.background = L[1];
        R.ui.legend.append(el("span", "", L[0]), g, el("span", "", L[2]));
    }

    // Place tiles for one layer. span = on-screen size of one tile; tz = tile zoom.
    function tiles(layerEl, tz, span, urlFor, onImg) {
        const w = R.ui.map.clientWidth, h = R.ui.map.clientHeight;
        if (!w || !h) return;
        const cx = lon2x(R.lon, R.z), cy = lat2y(R.lat, R.z), n = Math.pow(2, tz);
        const x0 = Math.floor((cx - w / 2) / span), x1 = Math.floor((cx + w / 2) / span);
        const y0 = Math.max(0, Math.floor((cy - h / 2) / span)), y1 = Math.min(n - 1, Math.floor((cy + h / 2) / span));
        const keep = new Set();
        for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
            const wx = ((tx % n) + n) % n, url = urlFor(tz, wx, ty), key = tx + ":" + ty + ":" + url;
            keep.add(key);
            let img = layerEl.querySelector('img[data-key="' + key + '"]');
            if (!img) { img = el("img"); img.dataset.key = key; img.dataset.url = url; img.draggable = false; img.alt = ""; layerEl.append(img); if (onImg) onImg(img, url); else img.src = url; }
            img.style.cssText = "left:" + Math.round(tx * span - (cx - w / 2)) + "px;top:" + Math.round(ty * span - (cy - h / 2)) + "px;width:" + Math.ceil(span) + "px;height:" + Math.ceil(span) + "px";
        }
        layerEl.querySelectorAll("img").forEach(i => { if (!keep.has(i.dataset.key)) i.remove(); });
    }

    function render() {
        if (!R.root || !R.root.isConnected) return;
        const z = R.z;
        tiles(R.layers.base, z, 256, (tz, x, y) => CARTO("dark_nolabels", tz, x, y));
        tiles(R.layers.labels, z, 256, (tz, x, y) => CARTO("dark_only_labels", tz, x, y));
        // Radar: a 512-px tile at zoom rz spans 256 * 2^(z - rz) screen px (upscaled past RainViewer's max zoom 7).
        const rz = Math.max(0, Math.min(z - 1, RADAR_MAXZ)), span = 256 * Math.pow(2, z - rz);
        R.frames.forEach((f, i) => {
            let layer = R.layers.radar.querySelector('[data-f="' + f.path + '"]');
            if (!layer) { layer = el("div", "rd-frame"); layer.dataset.f = f.path; R.layers.radar.append(layer); }
            const prio = (R.frames.length - 1 - i) * 1000;
            tiles(layer, rz, span, (tz, x, y) => R.host + f.path + "/512/" + tz + "/" + x + "/" + y + "/2/1_1.png",
                (img, url) => { img.addEventListener("load", () => img.classList.add("ok")); img.addEventListener("error", () => img.classList.add("ok", "bad")); want(img, url, prio + Math.random()); });
        });
        R.layers.radar.querySelectorAll(".rd-frame").forEach(l => { if (!R.frames.some(f => f.path === l.dataset.f)) l.remove(); });
        // Pin on the chosen place.
        if (R.place) {
            const w = R.ui.map.clientWidth, h = R.ui.map.clientHeight;
            const px = lon2x(R.place.lon, z) - lon2x(R.lon, z) + w / 2, py = lat2y(R.place.lat, z) - lat2y(R.lat, z) + h / 2;
            R.layers.pin.style.left = px + "px"; R.layers.pin.style.top = py + "px";
            R.layers.pin.textContent = ""; R.layers.pin.append(el("i"), el("b", "", String(R.place.label || "").toUpperCase()));
        }
        wantGrid();
        drawTicks(); showFrame();
    }

    // ---- Grid of Open-Meteo points covering the view (fetched again when you pan off it, zoom, or it's 10 min old) ----
    function view() { const w = R.ui.map.clientWidth, h = R.ui.map.clientHeight; return { w, h, cx: lon2x(R.lon, R.z), cy: lat2y(R.lat, R.z) }; }
    function gridCovers(g, v) {
        if (!g || g.z !== R.z || Date.now() - g.at > GRID_TTL) return false;
        return v.cx - v.w / 2 >= g.x0 && v.cy - v.h / 2 >= g.y0 && v.cx + v.w / 2 <= g.x0 + (g.cols - 1) * g.step && v.cy + v.h / 2 <= g.y0 + (g.rows - 1) * g.step;
    }
    function wantGrid() { clearTimeout(R.gridTimer); R.gridTimer = setTimeout(loadGrid, 450); }
    async function loadGrid() {
        const v = view(); if (!v.w || !v.h || R.gridBusy) return;
        if (gridCovers(R.grid, v)) return;
        R.gridBusy = true;
        const step = Math.max(v.w, v.h) / 9, pad = step * 1.5;
        const x0 = v.cx - v.w / 2 - pad, y0 = v.cy - v.h / 2 - pad;
        const cols = Math.ceil((v.w + 2 * pad) / step) + 1, rows = Math.ceil((v.h + 2 * pad) / step) + 1;
        const lats = [], lons = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { lats.push(y2lat(y0 + j * step, R.z).toFixed(3)); lons.push(x2lon(x0 + i * step, R.z).toFixed(3)); }
        if (R.place) { lats.push(R.place.lat.toFixed(3)); lons.push(R.place.lon.toFixed(3)); }
        const imp = imperial();
        const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats.join(",") + "&longitude=" + lons.join(",") +
            "&current=precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cape" +
            "&minutely_15=precipitation&forecast_minutely_15=" + (FC_STEPS + 1) + "&wind_speed_unit=" + (imp ? "mph" : "kmh") + "&timezone=GMT";
        try {
            const r = await fetch(url); let j = await r.json(); if (!Array.isArray(j)) j = [j];
            const pts = j.map(p => ({
                cloud: p.current.cloud_cover, ws: p.current.wind_speed_10m, wd: p.current.wind_direction_10m, wg: p.current.wind_gusts_10m,
                p: p.current.pressure_msl, cape: p.current.cape || 0,
                pr: ((p.minutely_15 && p.minutely_15.precipitation) || []).map(x => (x || 0) * 4)   // mm per 15 min -> mm/h
            }));
            const times = ((j[0].minutely_15 && j[0].minutely_15.time) || []).map(t => Date.parse(t + "Z"));
            const now = Date.now(), fc = [];
            times.forEach((t, k) => { if (t > now + 2 * 60000 && fc.length < FC_STEPS) fc.push({ time: t, k }); });
            const here = R.place ? pts.pop() : null;
            const wasLen = tlLen();
            R.grid = { z: R.z, x0, y0, step, cols, rows, pts, fc, here, at: Date.now() };
            if (tlLen() !== wasLen && R.fi >= R.frames.length) R.fi = Math.max(0, R.frames.length - 1);
            drawTicks(); showFrame();
        } catch (e) { /* keep the last grid */ }
        R.gridBusy = false;
    }

    // Smooth field: bilinear-interpolate grid values, color each pixel, scale up.
    function drawField(ctx, v, valueAt, stops) {
        const g = R.grid, S = 6, W = (g.cols - 1) * S + 1, H = (g.rows - 1) * S + 1;
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const cx2 = c.getContext("2d"), img = cx2.createImageData(W, H);
        for (let y = 0; y < H; y++) {
            const gy = y / S, j = Math.min(g.rows - 2, Math.floor(gy)), ty = gy - j;
            for (let x = 0; x < W; x++) {
                const gx = x / S, i = Math.min(g.cols - 2, Math.floor(gx)), tx = gx - i;
                const a = valueAt(g.pts[j * g.cols + i]), b = valueAt(g.pts[j * g.cols + i + 1]), cc = valueAt(g.pts[(j + 1) * g.cols + i]), d = valueAt(g.pts[(j + 1) * g.cols + i + 1]);
                const val = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
                const col = lerpRGB(stops, val), o = (y * W + x) * 4;
                img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3];
            }
        }
        cx2.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        const sx = g.x0 - (v.cx - v.w / 2), sy = g.y0 - (v.cy - v.h / 2);
        ctx.drawImage(c, sx, sy, (g.cols - 1) * g.step, (g.rows - 1) * g.step);
    }
    function drawWx(fcK) {
        const cv = R.layers.wx, v = view(), dpr = window.devicePixelRatio || 1;
        if (cv.width !== Math.round(v.w * dpr) || cv.height !== Math.round(v.h * dpr)) { cv.width = Math.round(v.w * dpr); cv.height = Math.round(v.h * dpr); }
        const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, v.w, v.h);
        const g = R.grid;
        if (!g || g.z !== R.z) return;
        const imp = imperial();
        const sxy = idx => [g.x0 + (idx % g.cols) * g.step - (v.cx - v.w / 2), g.y0 + Math.floor(idx / g.cols) * g.step - (v.cy - v.h / 2)];
        const inView = ([x, y]) => x > -10 && y > -10 && x < v.w + 10 && y < v.h + 10;
        if (R.layer === "rain" && fcK !== undefined) drawField(ctx, v, p => p.pr[fcK] || 0, PRECIP);
        else if (R.layer === "clouds") drawField(ctx, v, p => p.cloud || 0, CLOUD);
        else if (R.layer === "storms") drawField(ctx, v, p => p.cape || 0, CAPE);
        else if (R.layer === "pressure") {
            drawField(ctx, v, p => p.p || 1013, PRESS);
            let hi = -1, lo = -1;
            g.pts.forEach((p, i) => { if (!inView(sxy(i))) return; if (hi < 0 || p.p > g.pts[hi].p) hi = i; if (lo < 0 || p.p < g.pts[lo].p) lo = i; });
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            g.pts.forEach((p, i) => {
                const [x, y] = sxy(i); if (!inView([x, y]) || (i % 2) !== (Math.floor(i / g.cols) % 2)) return;
                ctx.font = "600 11px 'Segoe UI', sans-serif"; ctx.fillStyle = "rgba(236,235,230,.75)";
                ctx.fillText(imp ? (p.p * 0.02953).toFixed(2) : Math.round(p.p), x, y);
            });
            const mark = (i, t, col) => { if (i < 0) return; const [x, y] = sxy(i); ctx.font = "800 26px 'Segoe UI', sans-serif"; ctx.fillStyle = col; ctx.fillText(t, x, y - 16); };
            if (g.pts[hi] && g.pts[lo] && g.pts[hi].p - g.pts[lo].p >= 2) { mark(hi, "H", "#7fb2e0"); mark(lo, "L", "#f0605f"); }
        } else if (R.layer === "wind") {
            g.pts.forEach((p, i) => {
                const [x, y] = sxy(i); if (!inView([x, y])) return;
                const mph = imp ? p.ws : p.ws / 1.609, col = rgba(lerpRGB(WINDC, mph));
                const ang = (p.wd + 180) * Math.PI / 180, len = Math.min(g.step * 0.42, 10 + mph * 1.1);   // arrow points where the wind is going
                const dx = Math.sin(ang) * len / 2, dy = -Math.cos(ang) * len / 2;
                ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
                const hx = x + dx, hy = y + dy, a2 = Math.atan2(dy, dx);
                ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 7 * Math.cos(a2 - 0.5), hy - 7 * Math.sin(a2 - 0.5)); ctx.lineTo(hx - 7 * Math.cos(a2 + 0.5), hy - 7 * Math.sin(a2 + 0.5)); ctx.closePath(); ctx.fill();
                ctx.font = "600 10px 'Segoe UI', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(236,235,230,.7)";
                ctx.fillText(Math.round(p.ws), x, y + len / 2 + 10);
            });
        }
    }
    // Readout for the pinned place (CLOUDS / WIND / PRESSURE / STORMS).
    function readout() {
        const h = R.grid && R.grid.here, name = String((R.place && R.place.label) || "").toUpperCase(), imp = imperial();
        if (!h) return name + "  ·  LOADING…";
        if (R.layer === "clouds") return name + "  ·  " + Math.round(h.cloud) + "% CLOUD COVER" + (h.cloud < 20 ? "  ·  CLEAR" : h.cloud > 80 ? "  ·  OVERCAST" : "");
        if (R.layer === "wind") return name + "  ·  " + card(h.wd) + " " + Math.round(h.ws) + (imp ? " MPH" : " KM/H") + "  ·  GUSTS " + Math.round(h.wg);
        if (R.layer === "pressure") return name + "  ·  " + (imp ? (h.p * 0.02953).toFixed(2) + " inHg  (" + Math.round(h.p) + " hPa)" : Math.round(h.p) + " hPa");
        if (R.layer === "storms") { const c = h.cape; return name + "  ·  STORM RISK " + (c < 300 ? "NONE" : c < 1000 ? "LOW" : c < 2500 ? "MODERATE" : "HIGH") + "  ·  CAPE " + Math.round(c); }
        return name;
    }

    const ready = layer => { const imgs = layer.querySelectorAll("img"); return imgs.length > 0 && [...imgs].every(i => i.classList.contains("ok")); };
    const frameReady = i => { const t = tlAt(i); if (t.kind === "fc") return !!R.grid; const l = R.layers.radar.querySelector('[data-f="' + t.f.path + '"]'); return !!l && ready(l); };
    function showFrame() {
        if (!R.root) return;
        const rain = R.layer === "rain", n = tlLen();
        R.ui.bar.classList.toggle("read", !rain);
        if (!rain) {
            R.layers.radar.querySelectorAll(".rd-frame").forEach(l => l.classList.remove("on"));
            drawWx(); R.ui.read.textContent = readout(); return;
        }
        if (!n) return;
        R.fi = Math.min(R.fi, n - 1);
        const t = tlAt(R.fi);
        R.layers.radar.querySelectorAll(".rd-frame").forEach(l => l.classList.toggle("on", t.kind === "radar" && l.dataset.f === t.f.path));
        drawWx(t.kind === "fc" ? t.k : undefined);
        const mins = Math.round((t.time - Date.now()) / 60000);
        R.ui.time.textContent = fmtTime(t.time) + "  ·  " + (t.kind === "fc" ? "IN " + (mins >= 60 ? Math.floor(mins / 60) + " H " + (mins % 60 ? (mins % 60) + " MIN" : "") : mins + " MIN") + "  ·  FORECAST" : (-mins <= 7 ? "NOW" : -mins + " MIN AGO"));
        R.ui.time.classList.toggle("fut", t.kind === "fc");
        [...R.ui.ticks.children].forEach((e, i) => e.classList.toggle("on", i === R.fi));
    }
    function drawTicks() {
        const n = tlLen();
        if (R.ui.ticks.children.length !== n) {
            R.ui.ticks.textContent = "";
            for (let i = 0; i < n; i++) {
                const e = el("i"); if (i >= R.frames.length) e.classList.add("fut"); if (i === R.frames.length - 1) e.classList.add("now");
                e.addEventListener("click", ev => { stop(ev); R.playing = false; drawPlay(); R.fi = i; showFrame(); }); R.ui.ticks.append(e);
            }
        }
        for (let i = 0; i < n; i++) R.ui.ticks.children[i].classList.toggle("ready", frameReady(i));
    }
    function tick() {
        clearTimeout(R.anim);
        if (!R.root || !R.root.isConnected) return;
        const n = tlLen();
        if (R.layer !== "rain") { showFrame(); R.anim = setTimeout(tick, 30000); return; }
        if (!n) { R.anim = setTimeout(tick, 800); return; }
        drawTicks();
        let any = false; for (let i = 0; i < n; i++) if (frameReady(i)) { any = true; break; }
        if (!any) { R.fi = Math.max(0, R.frames.length - 1); showFrame(); R.ui.time.textContent = "LOADING RADAR…"; R.anim = setTimeout(tick, 600); return; }
        if (R.playing) {
            let k = R.fi;
            for (let s = 0; s < n; s++) { k = (k + 1) % n; if (frameReady(k)) break; }
            R.fi = k; showFrame();
        }
        const nowIdx = R.frames.length - 1;
        R.anim = setTimeout(tick, R.fi === n - 1 ? LAST_HOLD_MS : R.fi === nowIdx ? 1100 : FRAME_MS);
    }

    async function loadFrames() {
        clearTimeout(R.refresh);
        try {
            const r = await fetch(RV_API, { cache: "no-store" });
            const j = await r.json();
            R.host = j.host || "https://tilecache.rainviewer.com";
            const past = (j.radar && j.radar.past) || [];
            R.frames = past.slice(-PAST_FRAMES);
            R.fi = Math.max(0, R.frames.length - 1);   // start at NOW, then play into the forecast
            render(); tick();
        } catch (e) {
            R.ui.time.textContent = "RADAR OFFLINE"; render(); tick();
        }
        R.refresh = setTimeout(() => { if (R.root && R.root.isConnected) { R.grid = null; loadFrames(); } }, 5 * 60000);
    }

    // Returns the (persistent) radar element, centered on place. Re-showing keeps the map where you left it.
    function show(place) {
        if (!R.root) { build(); R.z = Math.max(MINZ, Math.min(MAXZ, store("radarZoom") || START_Z)); }
        const changed = !R.place || R.place.lat !== place.lat || R.place.lon !== place.lon;
        R.place = place;
        if (changed) { R.lat = place.lat; R.lon = place.lon; R.grid = null; }
        requestAnimationFrame(() => { render(); if (!R.frames.length || changed) loadFrames(); else tick(); });
        return R.root;
    }
    function hide() { clearTimeout(R.anim); clearTimeout(R.refresh); }

    // ---- Place search (on-screen keyboard; a real keyboard works too) ----
    const S = { box: null, text: "", onPick: null, timer: 0, seq: 0 };
    function openSearch(onPick, home) {
        S.onPick = onPick; S.text = "";
        if (!S.box) {
            const box = el("div", "srch"); box.addEventListener("click", stop); box.addEventListener("pointerdown", stop);
            const top = el("div", "srch-top");
            const field = el("div", "srch-field"), close = el("span", "fc-btn", "✕");
            top.append(field, close);
            const results = el("div", "srch-res");
            const kb = el("div", "srch-kb");
            ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].forEach((row, ri) => {
                const r = el("div", "kb-row");
                [...row].forEach(ch => r.append(key(ch, () => type(ch))));
                if (ri === 2) r.append(key("⌫", back, "kb-wide"));
                kb.append(r);
            });
            const last = el("div", "kb-row");
            last.append(key(",", () => type(",")), key("SPACE", () => type(" "), "kb-space"), key("CLEAR", () => { S.text = ""; draw(); }, "kb-wide"));
            kb.append(last);
            box.append(top, results, kb);
            close.addEventListener("click", ev => { stop(ev); closeSearch(); });
            S.box = box; S.field = field; S.results = results;
            document.addEventListener("keydown", e => {
                if (!S.box || !S.box.isConnected) return;
                if (e.key === "Escape") closeSearch();
                else if (e.key === "Backspace") back();
                else if (e.key === "Enter") { const first = S.results.querySelector(".srch-hit"); if (first) first.click(); }
                else if (e.key.length === 1) type(e.key.toUpperCase());
                else return;
                e.preventDefault();
            });
        }
        S.home = home;
        document.getElementById("widget").append(S.box);
        draw();
    }
    function key(label, fn, cls) { const k = el("span", "kb-key" + (cls ? " " + cls : ""), label); k.addEventListener("click", ev => { stop(ev); fn(); }); return k; }
    function type(ch) { if (S.text.length < 40) { S.text += ch; draw(); } }
    function back() { S.text = S.text.slice(0, -1); draw(); }
    function closeSearch() { if (S.box) S.box.remove(); }
    function pick(p) { const rec = (store("recent") || []).filter(r => r.label !== p.label || r.sub !== p.sub); rec.unshift(p); store("recent", rec.slice(0, 5)); closeSearch(); if (S.onPick) S.onPick(p); }
    function chip(p, cls) { const c = el("span", "srch-hit " + (cls || ""), ""); c.append(el("b", "", p.label.toUpperCase()), el("span", "", p.sub ? "  " + p.sub.toUpperCase() : "")); c.addEventListener("click", ev => { stop(ev); pick(p); }); return c; }
    function draw() {
        S.field.textContent = S.text || "SEARCH ANY CITY";
        S.field.classList.toggle("empty", !S.text);
        clearTimeout(S.timer);
        if (S.text.trim().length < 2) {
            S.results.textContent = "";
            if (S.home) S.results.append(chip(S.home, "srch-home"));
            (store("recent") || []).forEach(p => S.results.append(chip(p)));
            return;
        }
        S.timer = setTimeout(lookup, 350);
    }
    async function lookup() {
        const q = S.text.split(",")[0].trim(), region = (S.text.split(",")[1] || "").trim().toLowerCase(), seq = ++S.seq;
        try {
            const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=" + encodeURIComponent(q));
            const j = await r.json(); if (seq !== S.seq) return;
            let list = (j.results || []).map(p => ({ lat: p.latitude, lon: p.longitude, label: p.name, sub: [p.admin1, p.country_code].filter(Boolean).join(", "), pop: p.population || 0 }));
            if (region) list = list.filter(p => p.sub.toLowerCase().includes(region)).concat(list.filter(p => !p.sub.toLowerCase().includes(region)));
            S.results.textContent = "";
            if (!list.length) S.results.append(el("span", "srch-none", "NO MATCHES"));
            list.slice(0, 6).forEach(p => S.results.append(chip(p)));
        } catch (e) { if (seq === S.seq) { S.results.textContent = ""; S.results.append(el("span", "srch-none", "SEARCH OFFLINE")); } }
    }

    window.BinxRadar = { show, hide };
    window.BinxSearch = { open: openSearch, close: closeSearch };
})();
