// Mic module: live/muted status for a named mic + tap-to-mute through a Stream Deck virtual key.
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    function prop(name) {
        if (Object.prototype.hasOwnProperty.call(window, name)) {
            const v = window[name];
            if (v !== undefined && v !== null && v !== "") return v;
        }
        try {
            const v = Function("return typeof " + name + " !== 'undefined' ? " + name + " : undefined")();
            if (v !== undefined && v !== null && v !== "") return v;
        } catch (e) {}
        return undefined;
    }

    const MUTE_AFTER_MS = 600, POLL_MS = 100, RETRY_MS = 5000;
    const mod = $("modMic"), hero = $("micHero"), sub = $("micSub");
    let stream = null, ctx = null, analyser = null, buf = null, reader = null;
    let pollTimer = 0, retryTimer = 0, starting = false;
    let lastSignalAt = 0, startedAt = 0, current = "", micLabel = "";
    let mobile = (() => { try { return localStorage.getItem("binxbar.mobile") === "1"; } catch (e) { return false; } })();   // GO MOBILE

    function epsilon() {
        let db = Number(prop("muteThreshold"));
        if (!Number.isFinite(db)) db = -81;
        db = Math.max(-140, Math.min(-30, db));
        return Math.pow(10, db / 20);
    }

    // Discord call status, read from the brightness of Discord's camera key (Stream Deck key 9):
    // Discord dims its keys when you're not in a voice channel.
    let discord = "unknown", discordLum = null, iconCount = 0;
    const DISCORD_KEY = 8, IN_CALL_LUM = 95, DEBUG_LUM = false;
    // Which mic Discord is really listening through (from the PC checker, resources/mic2.json).
    let dMic = "", dMicMain = true, dTimers = [], dPoll = 0;
    function shortMic(raw) { const m = String(raw).match(/\((.+)\)\s*$/); return (m ? m[1] : String(raw)).replace(/^\d+-\s*/, "").slice(0, 22); }
    function readDiscordMic() {
        fetch("resources/mic2.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || !j.discord) return;
            const list = j.discord.map(x => { const p = String(x).split("|"); return { name: shortMic(p[0]), main: p.includes("main") }; });
            const pick = list.find(x => !x.main) || list[0];
            const name = pick ? pick.name : "", main = pick ? pick.main : true;
            if (name === dMic && main === dMicMain) return;
            dMic = name; dMicMain = main;
            if (/state-live/.test(mod.className)) setLive();
        }).catch(() => {});
    }
    function discordMicChecks() {
        dTimers.forEach(clearTimeout); dTimers = [];
        [600, 2200, 4500, 7500].forEach(ms => dTimers.push(setTimeout(readDiscordMic, ms)));
    }
    function setLive() {
        if (mobile) { setState("live", "MOBILE MODE ACTIVATED"); return; }
        if (discord === "out") { setState("nocall", "UNMUTED"); return; }
        setState("live", dMic ? "ON DISCORD \u00b7 " + dMic.toUpperCase() : "ON DISCORD");
        mod.classList.toggle("wrong-mic", !mobile && !!dMic && !dMicMain);
    }
    function readDiscordIcon(url) {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement("canvas"); c.width = 48; c.height = 48;
                const g = c.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
                const d = g.getImageData(0, 0, 48, 48).data; let sum = 0, a = 0;
                for (let i = 0; i < d.length; i += 4) { const al = d[i + 3] / 255; sum += al * (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); a += al; }
                discordLum = Math.round(sum / (d.length / 4)) + "/" + Math.round(100 * a / (d.length / 4)) + "/" + (url.length % 1000);
                discord = parseInt(discordLum) >= IN_CALL_LUM ? "in" : "out"; iconCount++;
                if (wasMuted) { current = ""; setState("muted"); }
                else if (/state-(live|nocall)/.test(mod.className)) setLive();
            } catch (e) {}
        };
        img.src = url;
    }
    // GO MOBILE: the headset's noise gate sends pure silence between words, so sound level can't tell muted
    // from quiet. Instead read Windows' mute state from the headset Toggle Mute key's icon (red slash = muted).
    let mobMuted = null;
    function readMobileMuteIcon(url) {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement("canvas"); c.width = 48; c.height = 48;
                const g = c.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
                const d = g.getImageData(0, 0, 48, 48).data; let red = 0;
                for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 110) red++;
                mobMuted = red > 20;
                if (mobile) { current = ""; if (mobMuted) setState("muted"); else setLive(); }
            } catch (e) {}
        };
        img.src = url;
    }
    // Virtual Stream Deck: 8 across x 4 down (the size of a Stream Deck XL).
    // Keys 1-12 (logical 0-11) are the left 3 columns, read left to right, top to bottom.
    // Channel-join keys (logical 12+) fill the right 5 columns, the same way.
    const SD_COLS = 8, SD_ROWS = 4;
    function phys(k) { if (k < 12) return Math.floor(k / 3) * SD_COLS + k % 3; const j = k - 12; return Math.floor(j / 5) * SD_COLS + 3 + j % 5; }
    function logical(i) { const r = Math.floor(i / SD_COLS), c = i % SD_COLS; return c < 3 ? r * 3 + c : 12 + r * 5 + (c - 3); }
    function hookIcons() {
        const p = sd(); if (!p || hookIcons.done || !p.buttonIconUpdated) return;
        hookIcons.done = true;
        try { p.buttonIconUpdated.connect((w, idx, url) => { if (w !== wid() || !url) return; idx = logical(idx); if (idx === DISCORD_KEY) readDiscordIcon(url); else if (idx === 10) readMobileMuteIcon(url); }); } catch (e) {}
    }

    // Second-mic guard: a small checker on the PC (mic-guard) writes resources/mic2.json when the
    // main mic is muted. If Discord is still hearing another mic, flash a warning.
    let warn2 = "", m2Timers = [], wasMuted = false;
    function readMic2() {
        fetch("resources/mic2.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            const on = !mobile && !!(j && j.mainMuted && j.live && j.live.length && Date.now() - j.t < 20000);
            let name = "";
            if (on) name = shortMic(j.live[0]);
            const changed = name !== warn2; warn2 = name;
            if (changed && wasMuted) { current = ""; setState("muted"); }
            if (warn2 && wasMuted) m2Timers.push(setTimeout(readMic2, 3000));
        }).catch(() => {});
    }
    function mic2Checks(start) {
        m2Timers.forEach(clearTimeout); m2Timers = [];
        if (start) [1200, 2600, 4500, 7000].forEach(ms => m2Timers.push(setTimeout(readMic2, ms)));
        else warn2 = "";
    }

    function setState(state, note) {
        if (state === "live" && !/state-live/.test(mod.className)) { discordMicChecks(); clearInterval(dPoll); dPoll = setInterval(readDiscordMic, 4000); }
        if (state !== "live") { mod.classList.remove("wrong-mic"); clearInterval(dPoll); dPoll = 0; }
        const muted = state === "muted";
        if (muted !== wasMuted) { wasMuted = muted; mic2Checks(muted); }
        if (mobile && muted) note = "MOBILE MODE ACTIVATED";
        if (muted && warn2) { state = "warn2"; note = mainLabel() + " MUTED"; }
        else if (muted && discord === "out" && !mobile) { state = "nocall"; note = "MUTED"; }   // gray means "not in a call", muted or not
        else if (muted && !mobile && !note) note = discord === "in" ? "ON DISCORD \u00b7 " + (dMic || micLabel).toUpperCase() : "";
        mod.classList.toggle("nocall-muted", muted && state === "nocall");
        const key = state + "|" + (note || "") + "|" + micLabel + "|" + discordLum;
        if (key === current) return;
        current = key;
        mod.classList.remove("state-live", "state-muted", "state-idle", "state-error", "state-nocall", "state-warn2");
        mod.classList.add("state-" + state);
        hero.textContent = state === "live" ? "LIVE" : state === "nocall" ? "NOT IN DISCORD" : state === "muted" ? "MUTED" : state === "warn2" ? "2ND MIC HOT" : state === "error" ? "NO MIC" : "CHECKING";
        sub.textContent = (note || micLabel.toUpperCase()) + (DEBUG_LUM && discordLum !== null ? "  \u00b7  " + discordLum + " #" + iconCount : "");
        $("micSub2").textContent = state === "warn2" ? "DISCORD HEARS " + warn2.toUpperCase() : "";
        repaint();
    }
    // The Edge sometimes only redraws part of the panel after a change, leaving old red/green bits.
    // Nudge the whole tile so it redraws completely.
    function repaint() {
        const w = document.getElementById("widget"); if (!w) return;
        w.classList.remove("flush"); void w.offsetWidth; w.classList.add("flush");
        clearTimeout(repaint.t); repaint.t = setTimeout(() => w.classList.remove("flush"), 1200);
        w.style.opacity = "0.995";
        requestAnimationFrame(() => requestAnimationFrame(() => { w.style.opacity = ""; }));
        setTimeout(() => { w.style.transform = "translateZ(0)"; requestAnimationFrame(() => { w.style.transform = ""; }); }, 250);
    }

    function peakOf(a) { let p = 0; for (let i = 0; i < a.length; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > p) p = v; } return p; }

    function evaluate(peak) {
        const now = Date.now();
        if (mobile && mobMuted !== null) { if (mobMuted) setState("muted"); else setLive(); return; }
        if (peak > epsilon()) { lastSignalAt = now; setLive(); }
        else if (now - lastSignalAt >= MUTE_AFTER_MS && now - startedAt >= MUTE_AFTER_MS) setState("muted");
    }

    function poll() {
        if (!analyser || !ctx) return;
        if (ctx.state !== "running") { ctx.resume().catch(() => {}); return; }
        analyser.getFloatTimeDomainData(buf);
        evaluate(peakOf(buf));
    }

    function startProcessor(track) {
        if (typeof MediaStreamTrackProcessor !== "function") return false;
        try { reader = new MediaStreamTrackProcessor({ track }).readable.getReader(); } catch (e) { return false; }
        const r = reader; let last = 0, peak = 0;
        (function pump() {
            r.read().then(res => {
                if (res.done || r !== reader) return;
                const f = res.value;
                try { const b = new Float32Array(f.numberOfFrames); f.copyTo(b, { planeIndex: 0, format: "f32-planar" }); peak = Math.max(peak, peakOf(b)); }
                catch (e) { peak = 1; } finally { f.close(); }
                const now = Date.now();
                if (now - last >= POLL_MS) { evaluate(peak); peak = 0; last = now; }
                pump();
            }).catch(retry);
        })();
        return true;
    }

    function stop() {
        clearInterval(pollTimer); pollTimer = 0;
        if (reader) { try { reader.cancel(); } catch (e) {} reader = null; }
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
        analyser = null;
    }

    function retry() { if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = 0; start(); }, RETRY_MS); }

    // Short label for your main mic, from the "Microphone Name Contains" setting (e.g. "YETI").
    function mobileName() { const n = prop("mobileMicName"); return typeof n === "string" && n.trim() ? n.trim() : "HEADSET"; }
    function mainLabel() { if (mobile) return mobileName().toUpperCase(); const n = prop("micName"); return (typeof n === "string" && n.trim() ? n.trim() : "MIC").toUpperCase(); }
    function wanted() { if (mobile) return mobileName().toLowerCase(); const n = prop("micName"); return typeof n === "string" ? n.trim().toLowerCase() : ""; }

    async function openMic() {
        const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
        const s = await navigator.mediaDevices.getUserMedia({ audio: base });
        const want = wanted();
        if (!want || !navigator.mediaDevices.enumerateDevices) return s;
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const match = devs.find(d => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications" && (d.label || "").toLowerCase().includes(want));
            if (!match) return s;
            const t = s.getAudioTracks()[0];
            if (t && t.getSettings && t.getSettings().deviceId === match.deviceId) return s;
            s.getTracks().forEach(x => x.stop());
            return navigator.mediaDevices.getUserMedia({ audio: Object.assign({}, base, { deviceId: { exact: match.deviceId } }) });
        } catch (e) { return s; }
    }

    function start() {
        if (starting) return;
        clearTimeout(retryTimer); retryTimer = 0;
        stop();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setState("error", "MIC ACCESS OFF"); retry(); return; }
        starting = true;
        setState("idle");
        openMic().then(s => {
            starting = false;
            stream = s; startedAt = Date.now(); lastSignalAt = 0;
            const track = s.getAudioTracks()[0];
            if (!track) { setState("error", "NO MICROPHONE"); retry(); return; }
            micLabel = (track.label || "").replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "").replace(/^Microphone\s*\((?:\d+-\s*)?(.*)\)$/i, "$1");
            track.addEventListener("ended", () => { setState("idle"); retry(); });
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                try {
                    ctx = new AC();
                    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; buf = new Float32Array(2048);
                    ctx.createMediaStreamSource(s).connect(analyser);
                    ctx.resume().catch(() => {});
                    pollTimer = setInterval(poll, POLL_MS);
                } catch (e) { ctx = null; analyser = null; }
            }
            setTimeout(() => {
                if (stream !== s) return;
                if (!ctx || ctx.state !== "running") {
                    clearInterval(pollTimer); pollTimer = 0;
                    if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; analyser = null; }
                    if (!startProcessor(track)) setState("idle", "TAP TO RETRY");
                }
            }, 1500);
        }).catch(err => {
            starting = false;
            const n = err && err.name;
            setState("error", n === "NotAllowedError" || n === "SecurityError" ? "MIC ACCESS OFF" : n === "NotFoundError" ? "NO MICROPHONE" : "TAP TO RETRY");
            retry();
        });
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        let t = 0;
        navigator.mediaDevices.addEventListener("devicechange", () => { clearTimeout(t); t = setTimeout(start, 800); });
    }

    // ---- Stream Deck: tap the mic panel to press virtual key 0 (Audio Mute toggle) ----
    function sd() { return (window.plugins && window.plugins.Streamdeck && typeof pluginStreamdeck_initialized !== "undefined" && pluginStreamdeck_initialized) ? window.plugins.Streamdeck : null; }
    function wid() { return (typeof iCUE !== "undefined" && iCUE && iCUE.widgetId) ? iCUE.widgetId : (prop("uniqueId") || ""); }
    let lastDev = null;
    // Virtual Stream Deck keys (3 columns x 4 rows; see README for the current layout):
    // 0 sound mute | 1 mic mute | 2-6 brightness 10/25/50/75/100 | 7 monitor off | 8 monitor on
    function connect() { const p = sd(); if (!p) return; hookIcons(); try { p.connectStreamDeck(wid(), prop("virtualDevice") || "", SD_COLS, SD_ROWS); } catch (e) {} }
    window.pluginStreamdeckEvents = { onInitialized: connect };
    // A freshly added tile can miss the first hookup, so connect again a few times after load.
    [1500, 5000, 12000, 30000].forEach(t => setTimeout(connect, t));
    function key(k, pressed) { const p = sd(); if (!p) return false; try { p.sendKeyPress(wid(), phys(k), pressed); return true; } catch (e) { return false; } }
    // A full press: key down, hold 150 ms so Stream Deck never drops it, key up.
    const SND = 0, MIC = 1, SWITCH_KEY = 7;
    const muteKey = () => mobile ? 10 : MIC;   // key 11 = Audio Devices Toggle Mute (headset)   // key 8 = Discord "Set Audio Device" (input = your main mic)
    let busy = false;
    function tapKey(k, hold) {
        if (!key(k, true)) return false;
        setTimeout(() => key(k, false), hold || 150);
        return true;
    }
    function store(n, v) { try { if (v === undefined) return localStorage.getItem("binxbar." + n); localStorage.setItem("binxbar." + n, v); } catch (e) { return null; } }

    // Turn any element into a tap target that ignores swipes and double-fires.
    function onTap(elm, fn) {
        let x = 0, y = 0, down = false;
        elm.addEventListener("pointerdown", e => { down = true; x = e.clientX; y = e.clientY; elm.classList.add("pressed"); });
        elm.addEventListener("pointerup", e => {
            elm.classList.remove("pressed"); if (!down) return; down = false;
            if (Math.abs(e.clientX - x) > 14 || Math.abs(e.clientY - y) > 14) return; // that was a swipe
            if (busy) return; busy = true; setTimeout(() => { busy = false; }, 350);
            e.stopPropagation(); fn(e);
        });
        elm.addEventListener("pointercancel", () => { down = false; elm.classList.remove("pressed"); });
        elm.addEventListener("pointerleave", () => { elm.classList.remove("pressed"); });
    }
    // Ask the mic guard on this PC to fix things: flip your main mic's mute off and back on quickly.
    // (Discord isn't listening to your main mic when these buttons show, so nobody hears the blip.)
    function guard() { if (!tapKey(MIC)) return false; setTimeout(() => tapKey(MIC), 450); return true; }
    window.Binxbar = { tapKey: (k, hold) => tapKey(k, hold), onTap: (el, fn) => onTap(el, fn), repaint: () => repaint() };
    const micMuted = () => wasMuted;

    // "SWITCH TO <your mic>": presses Discord's Set Audio Device key, which sets Discord's input to your main mic.
    setInterval(() => { const b = $("toMainMic"); if (!/\u2026|COULDN/.test(b.textContent)) b.textContent = "SWITCH TO " + mainLabel(); }, 2000);
    onTap($("toMainMic"), () => {
        const b = $("toMainMic"); b.textContent = "SWITCHING\u2026";
        guard();   // wake the mic guard first (Discord isn't on your main mic yet, so the blip is silent)
        setTimeout(() => tapKey(SWITCH_KEY), 1100);   // Discord "Set Audio Device" (Set Input -> your main mic)
        [5500, 8000].forEach(ms => setTimeout(readDiscordMic, ms));
        setTimeout(() => { b.textContent = dMicMain ? "SWITCH TO " + mainLabel() : "COULDN'T SWITCH"; }, 8600);
        setTimeout(() => { b.textContent = "SWITCH TO " + mainLabel(); }, 13000);
    });

    // "MUTE 2ND MIC": ask the mic guard on this PC to mute the other mic Discord is hearing.
    onTap($("mute2"), () => {
        const b = $("mute2"); b.textContent = "MUTING\u2026";
        guard();
        [3500, 6000].forEach(ms => setTimeout(readMic2, ms)); setTimeout(() => { b.textContent = "MUTE 2ND MIC"; }, 6000);
    });

    // Mic panel
    onTap(mod, () => {
        if (mobile) { goMobile(false); return; }
        if (tapKey(muteKey())) { setTimeout(updateAll, 900); return; }
        if (ctx && ctx.state !== "running") ctx.resume().catch(() => {}); else start();
    });

    // Headphones / sound (state is what was last set from here)
    const hp = $("audHp"), hpLabel = $("hpLabel"), all = $("audAll"), allLabel = $("allLabel");
    let soundOn = store("soundOn") !== "0";
    function drawHp() {
        hp.classList.toggle("hp-on", soundOn); hp.classList.toggle("hp-off", !soundOn);
        hpLabel.textContent = soundOn ? "ON" : "MUTED"; updateAll(); repaint();
    }
    function setSound(on) { if (on === soundOn) return; if (tapKey(SND)) { soundOn = on; store("soundOn", on ? "1" : "0"); drawHp(); } }
    function updateAll() {
        const off = micMuted() && !soundOn;
        all.classList.toggle("all-off", off); all.classList.toggle("all-on", !off);
        allLabel.textContent = off ? "ALL MUTED" : "MUTE ALL";
    }
    onTap(hp, () => setSound(!soundOn));
    onTap(all, () => {
        if (micMuted() && !soundOn) { tapKey(muteKey()); setTimeout(() => setSound(true), 250); }
        else { if (!micMuted()) tapKey(muteKey()); if (soundOn) setTimeout(() => setSound(false), 250); }
        setTimeout(updateAll, 900);
    });
    new MutationObserver(updateAll).observe(mod, { attributes: true, attributeFilter: ["class"] });

    // ---- GO MOBILE: Discord switches to your headset mic (Stream Deck key 10), and the tile follows that mic ----
    // Tap again to go back: Discord's input returns to your main mic (key 8). Mute taps use key 11 (headset mute).
    const MOBILE_KEY = 9, MOBILE_MUTE_KEY = 10;
    const mobBtn = $("audMob"), mobLabel = $("mobLabel");
    function drawMobile(msg) {
        mobBtn.classList.toggle("mob-on", mobile);
        mod.classList.toggle("mobile", mobile); $("modRow").classList.toggle("mobile", mobile);
        mobLabel.innerHTML = msg || (mobile ? "MOBILE<br>MODE<br>ACTIVATED" : "GO<br>MOBILE");
        repaint();
    }
    function setMobile(on) { mobile = on; store("mobile", on ? "1" : "0"); dMic = ""; current = ""; drawMobile(); start(); }
    onTap(mobBtn, () => goMobile(!mobile));
    function goMobile(goingMobile) {
        if (goingMobile === mobile) return;
        drawMobile("SWITCH-<br>ING\u2026");
        if (goingMobile === false) { hero.textContent = "BACK TO DESK"; sub.textContent = "SWITCHING TO " + (prop("micName") || "MIC").toString().toUpperCase() + "\u2026"; }
        if (!tapKey(goingMobile ? MOBILE_KEY : SWITCH_KEY)) { setTimeout(() => drawMobile(), 2500); return; }
        const wasLive = !wasMuted;
        setTimeout(() => {
            setMobile(goingMobile); [2500, 5500].forEach(ms => setTimeout(readDiscordMic, ms));
            if (goingMobile && wasLive) setTimeout(() => { if (mobile && mobMuted === true) tapKey(10); }, 1200);
        }, 600);
    }
    drawMobile();
    // Setting "GO MOBILE Button" off: hide the button (the mic panel takes its space) and go back to the desk mic.
    let mobAllowed = null;
    function applyMobileSetting() {
        const v = prop("showMobile"), allowed = !(v === false || v === "false");
        if (allowed === mobAllowed) return;
        mobAllowed = allowed; $("modRow").classList.toggle("no-mobile", !allowed);
        if (!allowed && mobile) goMobile(false);
        repaint();
    }
    applyMobileSetting(); setInterval(applyMobileSetting, 1000);

    // Slides (swipe the mic panel sideways, or tap the dots)
    const slides = $("slides");
    function goSlide(n) { slides.dataset.slide = String(n); repaint(); }
    let sx = 0, sy = 0;
    slides.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
    slides.addEventListener("pointerup", e => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goSlide(dx < 0 ? 1 : 0);
    });
    document.querySelectorAll("#slideDots i").forEach(d => onTap(d, () => goSlide(+d.dataset.s)));

    // Brightness slide
    const brVal = $("brVal"), power = $("brPower");
    const LEVELS = [10, 25, 50, 75, 100];
    function drawBr(v) {
        brVal.innerHTML = v ? v + "<small>%</small>" : "--";
        document.querySelectorAll("#brSteps button").forEach(b => b.classList.toggle("on", +b.dataset.v === +v));
        repaint();
    }
    drawBr(store("bright"));
    // Brightness keys step one preset at a time: key 3 = down, key 4 = up (edge-display\bright-down/up.vbs).
    const BR_DOWN = 2, BR_UP = 3; let brBusy = 0;
    document.querySelectorAll("#brSteps button").forEach(b => onTap(b, () => {
        const v = +b.dataset.v, from = Math.max(0, LEVELS.indexOf(+store("bright") || 50)), to = LEVELS.indexOf(v);
        let n = to - from; if (v === 100) n = 4; if (v === 10) n = -4;   // at the ends, over-press so it always lands right
        if (!n) return;
        clearTimeout(brBusy); store("bright", v); drawBr(v);
        let left = Math.abs(n); const k = n > 0 ? BR_UP : BR_DOWN;
        (function go() { if (left-- <= 0) return; tapKey(k); brBusy = setTimeout(go, 750); })();
    }));
    let monOn = true; store("monOn", "1");
    function drawPower() { power.classList.toggle("off", !monOn); power.classList.toggle("on", monOn); repaint(); }
    drawPower();
    function restoreBright() {}
    // (Power button retired: key 8 is now Discord's Set Audio Device. Turn the Edge off/on with a hotkey; see README.)
    // (Wake is handled by a Twinkle Tray hotkey; key 9 is now Discord's camera key.)
    drawHp();

    // Watch settings (mic name / device) once a second.
    let lastName = null;
    setInterval(() => {
        const n = wanted(); if (n !== lastName) { lastName = n; start(); }
        const d = prop("virtualDevice") || ""; if (d !== lastDev) { lastDev = d; connect(); }
    }, 1000);
    setState("idle");
})();

// Auto-reload: when the installed files are updated in place, reload the tile.
(function () {
    let first = null;
    async function check() {
        try {
            const r = await fetch("resources/build.txt?t=" + Date.now(), { cache: "no-store" });
            if (!r.ok) return;
            const v = (await r.text()).trim();
            if (first === null) first = v; else if (v !== first) location.reload();
        } catch (e) {}
    }
    check(); setInterval(check, 20000);
})();
