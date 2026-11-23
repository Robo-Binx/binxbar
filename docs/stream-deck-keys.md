# Stream Deck keys

Binxbar talks to the outside world by pressing keys on a virtual Stream Deck (iCUE creates it as **iCUE Widget N**). Set these up once in the Elgato Stream Deck app.

1. Open the **Stream Deck** app. At the top, pick the device called **iCUE Widget 1** (or whatever number you chose in step 2).
2. Stay on **page 1**. The grid is **8 keys across, 4 down** (the size of a Stream Deck XL). Keys below are numbered left to right, top to bottom: key 1 is top-left, key 8 is top-right, key 9 starts row 2.
3. Drag these actions from the right-hand list onto the keys:

```
        col 1        col 2        col 3        col 4         col 5      col 6      col 7      col 8
row 1   SOUND MUTE   MIC MUTE     BRT -        DISCONNECT    CHANNEL 1  CHANNEL 2  CHANNEL 3  CHANNEL 4
row 2   BRT +        VOL -        VOL +        CHANNEL 5     STREAM     SPEAKER    ANSWER     DECLINE
row 3   PLAYER       DESK MIC     IN-CALL      CALL BACK     PHONE      -          -          -
row 4   HEADSET MIC  HEADSET MUTE -            -             -          -          -          -
```

| Key | Action to drag on | Settings for that key |
|---|---|---|
| 1 · SOUND MUTE | System → **Multimedia** | Mute |
| 2 · MIC MUTE | Audio Mute → **Toggle Mute** | Device: **your mic** (pick it by name, not "default") |
| 3 · BRT − | System → **Open** | `edge-display\bright-down.vbs` |
| 4 · DISCONNECT | Discord → **Voice Channel** | Leave Server on **None (Leave any active channel)** |
| 5, 6, 7, 8 · CHANNEL 1–4 | Discord → **Voice Channel** | Server: yours. Voice Channel: the 1st–4th name in *Tap-to-Join Channels* |
| 9 · BRT + | System → **Open** | `edge-display\bright-up.vbs` |
| 10 · VOL − | System → **Multimedia** | Decrease Volume |
| 11 · VOL + | System → **Multimedia** | Increase Volume |
| 12 · CHANNEL 5 | Discord → **Voice Channel** | The 5th name in *Tap-to-Join Channels* |
| 13 · STREAM | Discord → **Stream Toggle** | Nothing to set |
| 14 · SPEAKER | System → **Open** | `edge-display\speaker-switch.vbs` *(SPEAKER button only; set your device names in `edge-display\speaker-switch.ini`)* |
| 15 · ANSWER | System → **Open** | `edge-display\phone-answer.vbs` *(phone features only, see [Phone](phone.md))* |
| 16 · DECLINE | System → **Open** | `edge-display\phone-decline.vbs` *(phone)* |
| 17 · PLAYER | System → **Open** | `edge-display\show-player.vbs` |
| 18 · DESK MIC | Discord → **Set Audio Device** | Mode **Set Input**, Input: **your mic** |
| 19 · IN-CALL | Discord → **Video Toggle** | Nothing. The tile never presses it; it reads the key's icon to tell if you're in a call. |
| 20 · CALL BACK | System → **Open** | `edge-display\phone-callback.vbs` *(phone)* |
| 21 · PHONE | System → **Open** | `edge-display\phone-reply.vbs` *(phone: REPLY on text alerts, and the PHONE app's calls and hang-up go through this key)* |
| 25 · HEADSET MIC | Discord → **Set Audio Device** | Mode **Set Input**, Input: **your headset mic** *(GO MOBILE only)* |
| 26 · HEADSET MUTE | Audio Mute → **Toggle Mute** | Device: **your headset mic** *(GO MOBILE only)* |

- **Keep the app on page 1.** The tile presses whatever page the app is showing.
- Skip what you don't use: no brightness → leave 3 and 9 empty; no speaker → leave 14 empty; no phone → leave 15, 16, 20 and 21 empty; GO MOBILE off → leave 25 and 26 empty; fewer channels → leave their keys empty.
- **Tip:** once one Voice Channel key is set up, click it, press **Ctrl+C**, click an empty key, **Ctrl+V**, and just change the channel.
- When you drop an action on a key that already has one, Stream Deck asks *"replace this action?"*. If dragging seems to do nothing, look for that pop-up.

