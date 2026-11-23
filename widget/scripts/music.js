// Music row: what's playing (any app, via iCUE's Media plugin), where it's playing, play/pause/skip, and PC volume.
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const row = $("modMusic"), art = $("muArt"), title = $("muTitle"), sub = $("muSub");
    const fill = $("muFill"), target = $("muTarget"), num = $("muNum"), bar = $("muBar");
    const VOL_DOWN = 4, VOL_UP = 5;          // Stream Deck keys 5 and 6 (Multimedia: Volume Down / Volume Up)
    const PLAYER_KEY = 6;                    // Stream Deck key 7: opens show-player.vbs (brings your music app up on your main monitor)
    const EXPAND_MS = 25000;                 // how long the row stays open after tapping the small MUSIC pill
    let mp = null, song = "", artist = "", playing = false, source = "", vol = null, volMuted = false, wins = [];

    // ---- now playing ----
    // Nothing playing -> the row shrinks to a small MUSIC pill. Tap the pill to bring the row back for a bit
    // (showing what you last played); double-tap the row or the pill to open your music app on your main monitor.
    const mem = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem("binxbar.music." + k) || "null"); localStorage.setItem("binxbar.music." + k, JSON.stringify(v)); } catch (e) { return null; } };
    let expandedUntil = 0, expandTimer = 0, lastArt = "";
    function draw() {
        const has = !!song;
        if (has) mem("last", { song, artist, source, art: lastArt });
        const last = mem("last") || {};
        const mini = false;   // always show the full row (idle = last played)
        row.classList.toggle("idle", !has);
        row.classList.toggle("mini", mini);
        row.classList.toggle("playing", has && playing);
        title.textContent = has ? song : (last.song ? last.song : "MUSIC");
        sub.textContent = has ? [artist, source].filter(Boolean).join("  ·  ").toUpperCase()
                              : (last.song ? ("LAST PLAYED  ·  " + [last.artist, last.source].filter(Boolean).join("  ·  ")).toUpperCase() : "DOUBLE-TAP TO OPEN YOUR PLAYER");
        if (!has) { art.style.backgroundImage = last.art ? "url(\"" + last.art + "\")" : ""; art.classList.toggle("empty", !last.art); }
        $("muMiniSrc").textContent = (source || last.source) ? "\u00b7  " + (source || last.source).toUpperCase() : "";
        if (window.Binxbar) window.Binxbar.repaint();
    }
    function expand() { expandedUntil = Date.now() + EXPAND_MS; clearTimeout(expandTimer); expandTimer = setTimeout(draw, EXPAND_MS + 50); draw(); }
    function openPlayer() {
        if (!(window.Binxbar && window.Binxbar.tapKey(PLAYER_KEY))) return;
        const was = sub.textContent; sub.textContent = "OPENING YOUR PLAYER\u2026";
        if (row.classList.contains("mini")) expand();
        setTimeout(() => { if (sub.textContent.indexOf("OPENING") === 0) sub.textContent = was; draw(); }, 2500);
    }
    // Single tap on the pill expands; double tap anywhere on the row/pill (not the buttons or volume) opens the player.
    let lastUp = 0, single = 0;
    row.addEventListener("pointerup", e => {
        if (e.target.closest(".mu-ctl, .mu-vol")) return;
        e.stopPropagation();
        const now = Date.now();
        if (now - lastUp < 380) { clearTimeout(single); lastUp = 0; openPlayer(); return; }
        lastUp = now;
        if (row.classList.contains("mini")) single = setTimeout(expand, 380);
        else if (!song) expand();   // keep it open while you're using it
    });
    function readAll() {
        if (!mp) return;
        try {
            song = String(mp.songName || "").trim(); artist = String(mp.artist || "").trim(); playing = !!mp.isPlaying;
            const t = String(mp.thumbnail || "");
            if (song && t && t.length < 400000) lastArt = t;
            if (!song) { findSource(); draw(); return; }
            art.style.backgroundImage = t ? "url(\"" + t + "\")" : "";
            art.classList.toggle("empty", !t);
        } catch (e) {}
        findSource(); draw();
    }
    function hook() {
        const p = window.plugins && window.plugins.Mediadataprovider;
        if (!p || mp) return; mp = p;
        ["songNameChanged", "artistChanged", "albumChanged", "thumbnailChanged", "isPlayingChanged"].forEach(sig => {
            try { mp[sig].connect(() => { clearTimeout(hook.t); hook.t = setTimeout(readAll, 120); }); } catch (e) {}
        });
        readAll();
    }
    window.pluginMediadataproviderEvents = { onInitialized: hook };
    [0, 800, 3000, 8000].forEach(ms => setTimeout(hook, ms));   // (deferred so everything below is set up first)
    setInterval(readAll, 5000);   // safety net in case a change signal is missed

    // ---- where it's playing: the PC helper lists player/browser window titles (resources/media-src.json) ----
    const SITES = [["youtube music", "YouTube Music"], ["youtube", "YouTube"], ["soundcloud", "SoundCloud"], ["twitch", "Twitch"],
        ["spotify", "Spotify"], ["apple music", "Apple Music"], ["pandora", "Pandora"], ["tidal", "Tidal"], ["deezer", "Deezer"],
        ["bandcamp", "Bandcamp"], ["amazon music", "Amazon Music"], ["kick", "Kick"]];
    const APPS = { spotify: "Spotify", vlc: "VLC", itunes: "iTunes", applemusic: "Apple Music", tidal: "Tidal", deezer: "Deezer",
        foobar2000: "foobar2000", musicbee: "MusicBee", winamp: "Winamp", aimp: "AIMP" };
    const BROWSERS = { chrome: "Chrome", msedge: "Edge", firefox: "Firefox", opera: "Opera", brave: "Brave", vivaldi: "Vivaldi", arc: "Arc" };
    function findSource() {
        source = "";
        if (!song) return;
        const key = song.toLowerCase().slice(0, 24);
        for (const w of wins) {
            const p = String(w.p || ""), t = String(w.t || "").toLowerCase();
            const app = Object.keys(APPS).find(a => p.startsWith(a));
            if (app && (t.includes(key) || app === "spotify" && !/^spotify( premium| free)?$/.test(t))) { source = APPS[app]; return; }
            const br = Object.keys(BROWSERS).find(b => p.startsWith(b));
            if (br && t.includes(key)) { const s = SITES.find(([k]) => t.includes(k)); source = s ? s[1] : BROWSERS[br]; return; }
        }
        // Not matched by title (e.g. a background tab): guess from any open site tab.
        for (const w of wins) { const t = String(w.t || "").toLowerCase(); const s = SITES.find(([k]) => t.includes(" - " + k) || t.includes("| " + k)); if (s) { source = s[1]; return; } }
    }
    function readSources() {
        fetch("resources/media-src.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null)
            .then(j => { if (j && Array.isArray(j.w)) { wins = j.w; const before = source; findSource(); if (source !== before) draw(); } }).catch(() => {});
    }
    readSources(); setInterval(readSources, 4000);

    // ---- controls ----
    const tap = (el, fn) => window.Binxbar ? window.Binxbar.onTap(el, fn) : el.addEventListener("click", fn);
    draw();
    tap($("muPlay"), () => {
        // No player running (showing "last played"): start your music app and resume it (Stream Deck key 7 -> show-player).
        if (!song) {
            if (window.Binxbar && window.Binxbar.tapKey(PLAYER_KEY)) { sub.textContent = "STARTING YOUR MUSIC\u2026"; [4000, 8000, 12000].forEach(ms => setTimeout(readAll, ms)); }
            return;
        }
        try { mp && mp.triggerPlayPause(); playing = !playing; draw(); setTimeout(readAll, 600); } catch (e) {}
    });
    tap($("muNext"), () => { try { mp && mp.triggerNextTrack(); setTimeout(readAll, 900); } catch (e) {} });
    tap($("muPrev"), () => { try { mp && mp.triggerPreviousTrack(); setTimeout(readAll, 900); } catch (e) {} });

    // ---- volume: level comes from the PC helper (resources/vol.json); changes go through Stream Deck volume keys ----
    function drawVol() {
        if (vol === null) { num.textContent = "--"; fill.style.width = "0%"; return; }
        num.textContent = volMuted ? "MUTE" : String(vol);
        fill.style.width = vol + "%";
        row.classList.toggle("vol-muted", volMuted);
    }
    function readVol() {
        fetch("resources/vol.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null)
            .then(j => { if (!j || typeof j.v !== "number") return; if (pressing) return; vol = j.v; volMuted = !!j.m; drawVol(); }).catch(() => {});
    }
    readVol(); setInterval(readVol, 1500);

    // Closed loop: press a volume key, re-read the real level, repeat until it lands on the target.
    // Works whatever step size the PC uses, and corrects any overshoot.
    var pressing = false, want = null, tries = 0, lastSeen = null, stuck = 0, lastV = null;
    function realVol() {
        return fetch("resources/vol.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null)
            .then(j => (j && typeof j.v === "number") ? j : null).catch(() => null);
    }
    function pump() {
        realVol().then(j => {
            if (j) { vol = j.v; volMuted = !!j.m; drawVol(); }
            if (j && j.v === lastV) stuck++; else stuck = 0; lastV = j ? j.v : null;
            const done = !j || want === null || Math.abs(vol - want) <= 1 || tries++ > 70 || stuck >= 6 ||   // level not moving: wrong device, stop
                         (lastSeen !== null && (vol > want) !== lastSeen);   // crossed the target: stop
            if (done) { pressing = false; want = null; target.style.opacity = "0"; return; }
            lastSeen = vol > want;
            if (!(window.Binxbar && window.Binxbar.tapKey(vol < want ? VOL_UP : VOL_DOWN, 50))) { pressing = false; want = null; target.style.opacity = "0"; return; }
            setTimeout(pump, 170);
        });
    }
    function setVolumeAt(clientX) {
        const r = bar.getBoundingClientRect();
        want = Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 100);
        target.style.left = want + "%"; target.style.opacity = "1";
        tries = 0; lastSeen = null; stuck = 0; lastV = null;
        if (!pressing) { pressing = true; pump(); }
    }
    $("muVol").addEventListener("pointerup", e => { e.stopPropagation(); setVolumeAt(e.clientX); });
    $("muVol").addEventListener("pointerdown", e => e.stopPropagation());
    // Sound output switch: tap to flip between your headset and your Bluetooth speaker.
    // Stream Deck key 14 runs speaker-switch.vbs, which writes resources/speaker.json.
    const SPEAKER_KEY = 19;
    const outBtn = $("muOut"), outLabel = $("muOutLabel");
    let outBusy = 0;
    function outText(now, next) { outLabel.innerHTML = "<b>" + now + "</b><span>" + next + "</span>"; }
    function readOut() {
        if (!outBtn) return;
        fetch("resources/speaker.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || Date.now() < outBusy) return;
            const m = /\(([^)]+)\)/.exec(String(j.device || ""));
            const spk = String(j.name || (j.speaker && m ? m[1].split(/\s+/)[0] : "") || "speaker").toUpperCase().slice(0, 10);
            outBtn.classList.toggle("on", !!j.speaker);
            if (j.speaker) outText("PLAYING " + spk, "SWITCH"); else outText("PLAYING HEADSET", "SWITCH");
            if (j.missing && Date.now() - j.t < 8000) { outText("NO " + spk, "IS IT ON?"); setTimeout(readOut, 3000); }
        }).catch(() => {});
    }
    if (outBtn) tap(outBtn, () => {
        if (!(window.Binxbar && window.Binxbar.tapKey(SPEAKER_KEY))) { outText("CAN'T", "TRY AGAIN"); setTimeout(readOut, 2500); return; }
        outBusy = Date.now() + 1500; outBtn.classList.add("pending");
        [1600, 3000, 5000].forEach(ms => setTimeout(readOut, ms)); setTimeout(() => outBtn.classList.remove("pending"), 5200);
    });
    readOut(); setInterval(readOut, 5000);
})();
