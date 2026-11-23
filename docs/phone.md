# Phone: calls, alerts and the PHONE app

Binxbar can show your phone's calls and texts on the Edge and let you call people from it. It works through **Microsoft Phone Link**, which is built into Windows 10/11. Your phone stays your phone: calls go out over your phone's own number and cell plan, and the audio plays through your PC (your headset).

> 🔒 **Your phone data stays on your PC.** Contacts, the recent-calls list and who your alerts come from are kept in files inside the Binxbar widget folder and in the widget's own storage, on your computer only. Binxbar never uploads them anywhere and nothing else uses them. Message text is never shown in alerts or stored. Details: [privacy.md](privacy.md).

## What you get

| | |
|---|---|
| 📞 **Call alerts** | An incoming call takes over the tile: **CALL INCOMING** with the caller's name, a soft ringtone, and **ANSWER** / **DECLINE** buttons. |
| 📵 **Missed calls** | **MISSED CALL** with a **CALL BACK** button. |
| 💬 **Text alerts** | A text from someone you picked takes over the tile: **MESSAGE INCOMING from Name** (never the message itself), with a **REPLY** button that opens that conversation in Phone Link on the Edge. |
| ☎️ **PHONE app** | Tap the phone icon left of the clock: **RECENT** (calls made and received), **KEYPAD** (dial pad that also finds contacts by spelling their name: 5‑6‑4‑6 finds *John*), **CONTACTS** (search box, A–Z jump, ★ favorites at the top, 🔔 per-person text alerts) and **MESSAGES** (opens Phone Link's messages). Your keyboard works too: type the number, **Enter** calls, **Backspace** deletes, **Esc** closes. |
| 🟢 **Call screen** | While a call is going: who it's with, a timer and a big **END CALL**. It says **DIALING …** until Phone Link actually has the call, and closes by itself when the call ends (from your phone, Phone Link or Binxbar). |

Phone Link does the dialing and hanging up in the background, off-screen, and hands focus back to whatever you were doing (your game, say).

## What you need

- Microsoft **Phone Link** on the PC (already installed on Windows 10/11; it's in the Start menu) and **Link to Windows** on your phone. Android works best; iPhone works for calls and alerts.
- Your PC needs **Bluetooth** (built in on most laptops and many motherboards; otherwise a cheap USB Bluetooth adapter). Calls go over Bluetooth.
- The **mic-guard** helper running ([installation step 5](installation.md#5-mic-guard-wrong-mic-warnings-volume-music-source-voice-bubbles)) and the **edge-display** folder from this repo.
- Stream Deck keys **15, 16, 20 and 21** ([Stream Deck keys](stream-deck-keys.md)).

## Setup

### 1. Link your phone to Phone Link
1. On the PC, open **Phone Link** from the Start menu and pick **Android** or **iPhone**.
2. Follow its QR-code pairing. On Android it installs **Link to Windows** (Samsung phones already have it under *Settings → Connected devices → Link to Windows*).
3. On the phone, allow everything Link to Windows asks for: **contacts, phone calls, SMS, notifications**. On Android, also *Settings → Notifications → Notification access → Link to Windows → On*. Without notification access the PC never hears about texts.

### 2. Turn on calls over Bluetooth
1. In Phone Link, open the **Calls** tab and click **Set up** / **Get started**. It pairs the PC and phone over Bluetooth; confirm the matching PIN on **both** screens.
2. Check it stuck: Windows **Settings → Bluetooth & devices → Mobile devices → Manage devices** → your phone → **Calls** must be **On**. (Phone Link can turn this off by itself after updates; if calls stop showing up, look here first.)
3. Make a test call from Phone Link's dial pad. You should hear it on your PC.

### 3. Let Phone Link show notifications on the PC
Binxbar reads Phone Link's Windows notifications, so they have to exist:
1. Windows **Settings → System → Notifications → Phone Link**: **On**, and **Show notification banners: On**. Turn on **Notifications** at the top of that page too.
2. Keep **Do not disturb** off on both the phone and the PC (Windows hides banners in Do not disturb and while a full-screen app has focus).
3. In Phone Link: ⚙️ **Settings → Features → Notifications → Choose which apps notify you**. Leave **Messages** and **Phone** on. Turn **off** anything you don't want popping up on your PC (Signal, Facebook, games...). This only affects the PC; your phone is unchanged.
4. Phone Link doesn't need to stay open on screen, but it has to be allowed to run in the background (its ⚙️ **Settings → General → Start Phone Link when I sign in to Windows**: On).

### 4. Turn on Binxbar's phone features
In `mic-guard\mic-guard.ini`:
```ini
PhoneCalls=on
PhoneAlertsFrom=*
```
- `PhoneCalls=on` → call alerts with ANSWER / DECLINE, and missed calls.
- `PhoneAlertsFrom` → whose **texts** can pop up. `*` lets every text through, and then you choose people with the 🔔 bell in the PHONE app's CONTACTS list. Or list names exactly as they're saved in your phone, comma separated: `Mom, Alex Smith`. Empty = no text alerts.

Save, then run `mic-guard\restart-mic-guard.vbs`.

### 5. Stream Deck keys
Add keys 15 (ANSWER), 16 (DECLINE), 20 (CALL BACK) and 21 (PHONE) as **System → Open** actions pointing at the matching `edge-display\phone-*.vbs` files. See [Stream Deck keys](stream-deck-keys.md).

### 6. Your contacts (for the PHONE app)
Phone Link keeps its copy of your contacts locked, so Binxbar uses an export from Google Contacts (where Android phones keep their contacts):
1. On any computer, open [contacts.google.com](https://contacts.google.com) → **Export** → *Contacts* → **Google CSV** → **Export**. You get `contacts.csv`.
2. Right-click `tools\import-contacts.ps1` → **Run with PowerShell**, and pick that `contacts.csv`.
3. It saves `contacts.json` into the Binxbar widget folder. Only names, numbers, number labels and the starred flag are kept. Run it again whenever you add contacts. You can delete `contacts.csv` afterwards.

iPhone: export a vCard from iCloud Contacts, import it into Google Contacts, then do the steps above. Or skip contacts: the keypad and RECENT work without them.

### 7. Start the Edge helper
Double-click `edge-display\edge-follow.vbs` once. It adds itself to Windows startup. Besides the call screen's DIALING / ON A CALL / ended status, it handles the [screen-follows-your-monitor and widgets/desktop keys](installation.md#screen-follows-your-main-monitor-and-a-key-to-switch-widgets--desktop).

## Using it
- **Answer a call:** tap **ANSWER** on the alert (or answer on the phone / Phone Link pop-up). The call screen comes up with a timer.
- **Make a call:** phone icon → KEYPAD (type the number or spell a name) or CONTACTS (search, or tap a letter) → tap the name or the green call button. Someone with several numbers shows each one to pick.
- **Hang up:** **END CALL**. It shows **HANGING UP …** until the call is really over.
- **Pick who can pop up:** CONTACTS → tap the 🔔 next to a name (green = their texts pop up). ★ pins favorites to the top.

## Good to know
- Binxbar can't see calls and texts that happened before it started, so RECENT fills up from the moment you set it up. Your full history is still in Phone Link.
- Phone Link has no way for other programs to place calls, so Binxbar briefly drives Phone Link's own dial pad with keyboard input, off-screen. It takes a few seconds from tap to ring.
- Calls use your phone's number and plan. Binxbar has no access to your phone beyond what Phone Link shows on the PC.

## Coming soon
- **TEXTS app:** read and answer texts on the Edge with your keyboard.
- **One inbox for everything:** a single list of messages waiting for an answer from Messages, Facebook Messenger, Discord DMs and more (from Windows notifications), with replies sent straight from Binxbar.

## Troubleshooting

| Problem | Fix |
|---|---|
| No alert when someone calls or texts | Phone Link → Settings → Notifications: Messages and Phone on. Windows Settings → Notifications → Phone Link: on, banners on. Phone: Link to Windows has notification access, Do not disturb off. `PhoneCalls=on` / `PhoneAlertsFrom` set and mic-guard restarted. `mic-guard.log` shows `phone alerts on`. |
| Texts from someone never pop up | Their 🔔 is off in CONTACTS, or `PhoneAlertsFrom` doesn't include them (use `*` to let the bells decide). |
| ANSWER does nothing | Stream Deck key 15 → `phone-answer.vbs`. Look in `edge-display\phone-action.log`. |
| Calls connect but you can't hear | Windows Settings → Bluetooth & devices → Mobile devices → your phone → **Calls** on. Your headset or speaker has to be the default output. |
| Tapping a contact doesn't call | Stream Deck key 21 → `phone-reply.vbs`, Stream Deck on page 1. `phone-action.log` says where it stopped. |
| The call screen doesn't close | Make sure `edge-follow.vbs` is running (its log is `edge-display\edge-follow.log`); END CALL always closes it. |
| CONTACTS is empty | Run `tools\import-contacts.ps1` with a Google Contacts export. |
