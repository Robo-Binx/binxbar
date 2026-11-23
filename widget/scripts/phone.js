// Phone alerts: a text from someone on your list, or any incoming call, takes over the whole tile.
// mic-guard reads Phone Link's Windows notifications and writes resources/phone.json (who + text/call, never the message).
(() => {
    "use strict";
    const box = document.getElementById("phoneAlert"); if (!box) return;
    const who = document.getElementById("paWho"), what = document.getElementById("paWhat"), acts = document.getElementById("paActs");
    // Buttons press Stream Deck keys that run phone-action.ps1 (presses the matching button in Phone Link).
    const KEY = { answer: 20, decline: 21, callback: 22, reply: 23, phone: 23 };
    let current = null;
    // Sounds: a ring for calls (repeats while the alert is up) and a short chime for texts. Plays on the default output.
    let actx = null, ringTimer = 0;
    function tone(freq, start, dur, vol) {
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === "suspended") actx.resume();
            const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + start;
            o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.start(t); o.stop(t + dur + 0.05);
        } catch (e) {}
    }
    // Warm, airy pad tones: each note is three slightly detuned sines (a soft chorus), a slow bloom and a long fade,
    // sent through a big soft reverb so it floats.
    let bus = null;
    function out() {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === "suspended") actx.resume();
        if (!bus) {
            bus = actx.createGain(); bus.gain.value = 1;
            const soft = actx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 2600; soft.Q.value = 0.5;
            const rev = actx.createConvolver(), len = Math.floor(actx.sampleRate * 3.2), ir = actx.createBuffer(2, len, actx.sampleRate);
            for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
            rev.buffer = ir; const dry = actx.createGain(), wet = actx.createGain(); dry.gain.value = 0.55; wet.gain.value = 0.5;
            bus.connect(soft); soft.connect(dry); dry.connect(actx.destination); soft.connect(rev); rev.connect(wet); wet.connect(actx.destination);
        }
        return bus;
    }
    function note(freq, start, dur, vol) {
        try {
            const dest = out(), t = actx.currentTime + start;
            [-6, 0, 6].forEach(cents => {
                const o = actx.createOscillator(), g = actx.createGain(), v = vol / 3;
                o.type = "sine"; o.frequency.value = freq * Math.pow(2, cents / 1200); o.connect(g); g.connect(dest);
                g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                o.start(t); o.stop(t + dur + 0.05);
            });
        } catch (e) {}
    }
    // Text: a gentle rising D-to-G over a low warm D, like a soft "hello".
    function chime() { note(293.66, 0, 1.7, 0.08); note(587.33, 0, 1.2, 0.13); note(783.99, 0.18, 1.5, 0.12); }
    // Call: a warm rising Cmaj9 chord, voiced low and soft so it doesn't ring in your ears; repeats while it rings.
    function ringOnce() { [261.63, 392.0, 493.88, 587.33, 659.25].forEach((f, i) => note(f, i * 0.16, 2.4, i < 2 ? 0.14 : 0.1)); }
    // iCUE only allows sound after the tile has been touched: any tap on Binxbar switches sound on for good.
    document.addEventListener("pointerdown", () => {
        try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {}
    }, true);
    function stopRing() { clearInterval(ringTimer); ringTimer = 0; }
    function btn(label, cls, action) {
        const b = document.createElement("button"); b.className = "pa-btn " + cls; b.textContent = label;
        b.addEventListener("pointerdown", e => e.stopPropagation());
        b.addEventListener("click", e => {
            e.stopPropagation();
            const ok = window.Binxbar && window.Binxbar.tapKey(KEY[action]);
            if (!ok) { b.textContent = "CAN'T"; return; }
            if (action === "decline") hide(true);
            else if (action === "callback" || action === "reply") setTimeout(() => hide(true), 800);
            else { b.textContent = "ANSWERING\u2026"; b.disabled = true; stopRing(); }
        });
        return b;
    }
    const TEXT_SHOW_MS = 10 * 60000, FRESH_MS = 120000;   // texts stay up until tapped (10 min backstop)
    let shownId = null, dismissed = (() => { try { return +localStorage.getItem("binxbar.phone.dismissed") || 0; } catch (e) { return 0; } })(), hideTimer = 0;

    function hide(remember) {
        stopRing();
        box.classList.remove("show", "call", "text", "missed"); clearTimeout(hideTimer);
        if (remember && shownId) { dismissed = shownId; try { localStorage.setItem("binxbar.phone.dismissed", String(shownId)); } catch (e) {} }
        shownId = null;
    }
    function show(j) {
        const isCall = j.kind === "call", isMissed = j.kind === "missed";
        what.textContent = isCall ? "CALL INCOMING" : isMissed ? "MISSED CALL" : "MESSAGE INCOMING";
        const name = String(j.who || "");
        who.textContent = /^\{/.test(name) || !name ? "" : "from " + name;
        if (/^\{/.test(name)) peekName(j.id);
        acts.replaceChildren();
        if (isCall) acts.append(btn("ANSWER", "pa-yes", "answer"), btn("DECLINE", "pa-no", "decline"));
        else if (isMissed) acts.append(btn("CALL BACK", "pa-yes", "callback"));
        else acts.append(btn("REPLY", "pa-reply", "reply"));
        box.classList.remove("call", "text", "missed"); box.classList.add("show", isCall ? "call" : isMissed ? "missed" : "text");
        shownId = j.id; clearTimeout(hideTimer); stopRing();
        if (isCall) { ringOnce(); ringTimer = setInterval(ringOnce, 3000); } else chime();
        if (!isCall) hideTimer = setTimeout(() => hide(true), TEXT_SHOW_MS);
    }
    // For calls Phone Link hides the caller's name; the helper reads it off the call pop-up into phone-who.txt.
    function peekName(id, tries) {
        tries = tries || 0; if (tries > 12 || shownId !== id) return;
        fetch("resources/phone-who.txt?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(t => {
            t = String(t || "").replace(/^\uFEFF/, "").trim();
            if (t && shownId === id) who.textContent = "from " + t; else setTimeout(() => peekName(id, tries + 1), 700);
        }).catch(() => setTimeout(() => peekName(id, tries + 1), 700));
    }
    let logged = null;
    function poll() {
        fetch("resources/phone.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || !j.id) return;
            window.BinxPhoneLast = j;
            const P = window.BinxPhone;
            // Calls and missed calls go in the PHONE app's RECENT list.
            if (P && j.id !== logged && (j.kind === "call" || j.kind === "missed") && Date.now() - j.t < 10 * 60000) { logged = j.id; P.addRecent({ kind: j.kind === "missed" ? "missed" : "in", name: /^\{/.test(String(j.who || "")) ? "" : String(j.who || "") }); }
            // Texts only pop up for people switched on in the PHONE app (the bell on their contact).
            if (j.kind === "text" && P && !P.isAlert(j.who)) return;
            if (j.kind === "call") {
                if (j.active && j.id !== dismissed) { if (shownId !== j.id || !box.classList.contains("call")) show(j); }
                else if (shownId === j.id) hide(true);
            } else if (j.kind === "missed") {
                if (j.id !== dismissed && j.id !== shownId && Date.now() - j.t < 30 * 60000) show(j);
            } else if (j.id !== dismissed && j.id !== shownId && Date.now() - j.t < FRESH_MS) show(j);
        }).catch(() => {});
    }
    box.addEventListener("pointerdown", e => e.stopPropagation());
    box.addEventListener("click", e => { e.stopPropagation(); hide(true); });
    poll(); setInterval(poll, 1500);
})();
