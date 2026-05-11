# Dash Notes — Setup Guide

Everything you need to get this running. No coding experience required.

---

## What You Need

- A free [GitHub](https://github.com) account
- A browser (Chrome or Edge recommended for full voice support)
- 10 minutes

---

## Step 1 — Fork the Repository

1. Go to the Dash Notes GitHub repository
2. Click **Fork** (top right)
3. This creates your own copy of the app

---

## Step 2 — Enable GitHub Pages

1. In your forked repository, click **Settings**
2. Click **Pages** in the left sidebar
3. Under **Source**, select **main branch** → **/ (root)**
4. Click **Save**
5. Wait 1–2 minutes — GitHub will show you your live URL

Your app is now live at:
```
https://yourusername.github.io/dash-notes/
```

Bookmark it on your phone. Add it to your home screen for the full app experience.

---

## Step 3 — Add to Your Phone Home Screen

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the three dots menu (top right)
3. Tap **Add to Home Screen**
4. Tap **Add**

**iPhone (Safari):**
1. Open the app URL in Safari
2. Tap the Share button (bottom centre)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app will behave like a native app on your phone.

---

## Understanding Your Data

**Where is my data stored?**
Everything you type, record, or save lives in your browser's local storage (IndexedDB). It does not go anywhere else.

**Can anyone see my data?**
No. It is private to your device and your browser.

**What if I clear my browser data?**
Your Dash Notes data will be deleted along with it. Use the Share or Download backup regularly to keep your data safe.

**How often should I back up?**
After any important session. One tap in the Backup section shares everything to your chosen app or downloads a file to your device.

**What about my voice notes?**
Voice notes are transcribed to text by your browser automatically. The text saves locally. The original audio recording is not stored.

**What about photos?**
Photos taken with your camera are used to capture handwritten notes. They are not stored in the app — they stay in your device's photo library.

---

## Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Goal Tracker | ✅ | ✅ | ✅ | ✅ |
| Eisenhower Matrix | ✅ | ✅ | ✅ | ✅ |
| Voice Recording | ✅ | ✅ | ✅ | ✅ |
| Voice Transcription | ✅ | ✅ | ⚠️ Limited | ⚠️ Limited |
| Camera Capture | ✅ | ✅ | ✅ | ✅ |
| Share Notes | ✅ | ✅ | ✅ | ✅ |
| Download Backup | ✅ | ✅ | ✅ | ✅ |

**Recommended: Chrome or Edge** for the best voice transcription experience.

---

## Troubleshooting

**Voice transcription not working**
- Make sure you are using Chrome or Edge
- Check that microphone permission is allowed for the app in your browser settings

**Data disappeared**
- Browser storage may have been cleared
- Restore from your downloaded backup file if you have one
- Go to the Backup section → Choose Backup File

**Share not working**
- On desktop browsers, sharing copies to clipboard — paste into your chosen app
- On mobile, the full native share sheet appears — choose your preferred app from there

**App not loading after GitHub Pages setup**
- Wait 2–3 minutes after enabling Pages
- Hard refresh the page (Ctrl+Shift+R on desktop)

---

## Credits

Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica

*Think it. Do it. Own it.*
