// Lounge strip: small bubbles showing who's in your Discord server's voice channels (you show as YOU), plus "X JOINED" bubbles.
// Data: resources/lounge.json, written every 30 s by the PC helper from the server's public widget feed.
(() => {
    "use strict";
    const box = document.getElementById("lgBubbles");
    const JOIN_MS = 12000;
    let known = null;            // name -> channel id, from the previous read
    let joins = [];              // { name, channel, until }
    let last = "";
    const YOU = "You";
    const GHOST_MS = 10 * 60000;   // after you leave a channel, keep its bubble (dimmed) this long
    let ghost = (() => { try { return JSON.parse(localStorage.getItem("binxbar.lounge.ghost") || "null"); } catch (e) { return null; } })();
    let myChan = null;
    const saveGhost = () => { try { localStorage.setItem("binxbar.lounge.ghost", JSON.stringify(ghost)); } catch (e) {} };

    function prop(name) {
        try { const v = Function("return typeof " + name + " !== 'undefined' ? " + name + " : undefined")(); if (v !== undefined && v !== null) return v; } catch (e) {}
        return window[name];
    }
    const metaDefault = n => { const m = document.querySelector('meta[content="' + n + '"]'); return m ? String(m.getAttribute("data-default") || "").replace(/^'|'$/g, "") : ""; };
    const me = () => String(prop("myDiscordName") || metaDefault("myDiscordName") || "").trim().toLowerCase();
    const short = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const clean = s => String(s || "").replace(/^[\s\-\u2013\u2014|]+|[\s\-\u2013\u2014|]+$/g, "") || String(s || "");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    // Tap a bubble to join that channel. Only the channels named in the setting "Tap-to-Join Channels" are tappable
    // (others still show). Each one is a Discord "Voice Channel" key on the virtual Stream Deck, in the same order:
    // keys 14, 15, 16, 17, 18 (right part of the 8x4 grid). Key 13 is a Voice Channel key with no server = leave.
    const DISCONNECT_KEY = 12, FIRST_JOIN_KEY = 13, MAX_JOIN_KEYS = 5;   // keys 14-18; key 19 is STREAM
    let order = [], pending = { ch: null, until: 0 };
    const norm = n => clean(n).toLowerCase().replace(/\s+/g, " ").trim();
    function joinList() {
        let v = prop("joinChannels");
        if (v === undefined || v === null || !String(v).trim()) {   // setting blank or not loaded yet (e.g. after a re-import): use its default
            const m = document.querySelector('meta[content="joinChannels"]'); v = m ? String(m.getAttribute("data-default") || "").replace(/^'|'$/g, "") : "";
        }
        return String(v || "").split(",").map(norm).filter(Boolean);
    }
    function keyFor(id) {
        const ch = order.find(c => c.id === id); if (!ch) return -1;
        const i = joinList().indexOf(norm(ch.name));
        return i >= 0 && i < MAX_JOIN_KEYS ? FIRST_JOIN_KEY + i : -1;
    }
    const tappable = id => id !== myChan && keyFor(id) >= 0 ? " lg-tap" : "";
    let downAt = null;
    box.addEventListener("pointerdown", e => { downAt = { x: e.clientX, y: e.clientY, el: e.target.closest(".lg-b") }; });
    box.addEventListener("pointerup", e => {
        const d = downAt; downAt = null; const el = e.target.closest(".lg-b");
        if (!d || !el || el !== d.el || Math.abs(e.clientX - d.x) > 14 || Math.abs(e.clientY - d.y) > 14) return;
        const B = window.Binxbar; if (!B) return;
        const id = el.dataset.ch, k = keyFor(id);
        if (!id || id === myChan || k < 0) return;
        if (B.tapKey(k)) { pending = { ch: id, until: Date.now() + 8000 }; el.classList.add("lg-pending"); [2500, 6000, 9000].forEach(ms => setTimeout(read, ms)); }
    });

    // Red DISCONNECT DISCORD button (next to the mic panel): key 13 is a Discord Voice Channel key with no server, which leaves any call.
    const dc = document.getElementById("audDc"), dcLabel = document.getElementById("dcLabel");
    function drawDc(msg) {
        if (!dc) return;
        dc.classList.toggle("dc-on", !!myChan);
        dcLabel.innerHTML = msg || (myChan ? "ESCAPE<br>DISCORD" : "NOT IN<br>VOICE");
    }
    if (dc && window.Binxbar) window.Binxbar.onTap(dc, () => {
        if (!window.Binxbar.tapKey(DISCONNECT_KEY)) { drawDc("CAN'T"); setTimeout(() => drawDc(), 2500); return; }
        drawDc("LEAVING\u2026"); [2500, 6000, 10000].forEach(ms => setTimeout(read, ms)); setTimeout(() => drawDc(), 10500);
    });

    // STREAM GAME button: key 19 is Discord "Stream Toggle" — Go Live with whatever game Discord sees you playing
    // (WoW, Arc Raiders, anything). Tap again to stop. Leaving voice ends a stream, so the button resets then too.
    const STREAM_KEY = 18, st = document.getElementById("audStream"), stLabel = document.getElementById("stLabel");
    let streaming = false;
    function drawSt(msg) {
        if (!st) return;
        st.classList.toggle("st-on", streaming);
        stLabel.innerHTML = msg || (streaming ? "STOP<br>STREAM" : "STREAM<br>GAME");
    }
    if (st && window.Binxbar) window.Binxbar.onTap(st, () => {
        if (!window.Binxbar.tapKey(STREAM_KEY)) { drawSt("CAN'T"); setTimeout(() => drawSt(), 2500); return; }
        streaming = !streaming; drawSt(streaming ? "GOING<br>LIVE\u2026" : "ENDING\u2026"); setTimeout(() => drawSt(), 2500);
    });
    const dcBusy = () => dcLabel && /LEAVING|CAN'T/.test(dcLabel.textContent) ? dcLabel.textContent : "";
    function render(rooms, state) {
        const now = Date.now();
        joins = joins.filter(j => j.until > now);
        let html = joins.map(j => `<span class="lg-b lg-join${tappable(j.ch)}" data-ch="${j.ch}"><b>${esc(short(j.name, 14).toUpperCase())}</b> JOINED ${esc(short(j.channel, 16).toUpperCase())}</span>`).join("");
        if (state === "offline") html += `<span class="lg-b lg-off">LOUNGE OFFLINE</span>`;
        else if (!rooms.length) html += `<span class="lg-b lg-empty">LOUNGE EMPTY</span>`;
        else html += rooms.map(r => {
            if (r.ghost) return `<span class="lg-b lg-ghost${tappable(r.id)}" data-ch="${r.id}"><b>${esc(short(r.name, 16).toUpperCase())}</b> EMPTY</span>`;
            const names = r.people.slice(0, 3).map(n => short(n, 12)).join(", ") + (r.people.length > 3 ? " +" + (r.people.length - 3) : "");
            const cls = r.id === myChan ? " lg-mine" : r.id === pending.ch && pending.until > now ? " lg-pending" : tappable(r.id);
            return `<span class="lg-b${cls}" data-ch="${r.id}"><i class="lg-dot"></i><b>${esc(short(r.name, 16).toUpperCase())}</b> ${esc(names.toUpperCase())}</span>`;
        }).join("");
        drawDc(dcBusy());
        if (html !== last) { last = html; box.innerHTML = html; if (window.Binxbar) window.Binxbar.repaint(); }
    }

    function read() {
        fetch("resources/lounge.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || !j.data || Date.now() - j.t > 5 * 60000) { render([], "offline"); return; }
            const chans = {}; (j.data.channels || []).forEach(c => { chans[c.id] = c; });
            order = j.data.channels || [];
            const skip = me(), byChan = {}, now = {}; let mine = null;
            (j.data.members || []).forEach(m => {
                if (!m.channel_id || !chans[m.channel_id]) return;
                const name = String(m.username || "").trim(); if (!name) return;
                if (skip && name.toLowerCase() === skip) { (byChan[m.channel_id] = byChan[m.channel_id] || []).push(YOU); mine = m.channel_id; return; }   // you: shown as YOU, no join alert
                (byChan[m.channel_id] = byChan[m.channel_id] || []).push(name); now[name] = m.channel_id;
            });
            if (known) Object.keys(now).forEach(n => { if (known[n] !== now[n]) joins.push({ name: n, ch: now[n], channel: clean(chans[now[n]].name), until: Date.now() + JOIN_MS }); });
            known = now;
            // Remember the channel you were in: when you leave, its bubble stays (dimmed, EMPTY) for 10 minutes.
            // (Also while you pop into another channel, so you can find your way back.)
            if (myChan && mine !== myChan) { ghost = { id: myChan, until: Date.now() + GHOST_MS }; saveGhost(); }
            if (!mine && myChan && streaming) { streaming = false; drawSt(); }
            myChan = mine; if (mine && mine === pending.ch) pending = { ch: null, until: 0 };
            if (ghost && ghost.id === mine) { ghost = null; saveGhost(); }
            if (ghost && (ghost.until < Date.now() || !chans[ghost.id])) { ghost = null; saveGhost(); }
            const rooms = Object.keys(byChan).map(id => ({ id, name: clean(chans[id].name), pos: chans[id].position || 0, people: byChan[id].sort((a, b) => (b === YOU) - (a === YOU) || a.localeCompare(b)) }))
                .concat(ghost && !byChan[ghost.id] ? [{ id: ghost.id, name: clean(chans[ghost.id].name), pos: chans[ghost.id].position || 0, people: [], ghost: true }] : [])
                .sort((a, b) => a.pos - b.pos);
            render(rooms, "ok");
        }).catch(() => render([], "offline"));
    }
    read(); setInterval(read, 10000);
    setInterval(() => { if (joins.length) read(); }, 2000);   // clear "JOINED" bubbles on time
})();
