# 3C Goal Tracker — Setup Guide

Everything you need to get this running. No coding experience required.

---

## What You Need

- A free [GitHub](https://github.com) account
- A free [EmailJS](https://www.emailjs.com) account
- A browser (Chrome or Edge recommended for full voice support)
- 15 minutes

---

## Step 1 — Fork the Repository

1. Go to the 3C Goal Tracker GitHub repository
2. Click **Fork** (top right)
3. This creates your own copy of the app

---

## Step 2 — Set Up EmailJS (Your Email Backup)

EmailJS lets the app send your goals and notes to your own email — no server needed.

1. Go to [emailjs.com](https://www.emailjs.com) and create a free account
2. Click **Add New Service** → choose your email provider (Gmail, Outlook, etc.)
3. Follow the connection steps — EmailJS will send a test email to confirm
4. Note down your **Service ID** (looks like `service_xxxxxxx`)
5. Click **Email Templates** → **Create New Template**
6. Set the template up like this:

```
Subject: 3C Goal Tracker — My Backup {{date}}

{{content}}

Sent from my 3C Goal Tracker
```

7. Note down your **Template ID** (looks like `template_xxxxxxx`)
8. Go to **Account** → note down your **Public Key**

---

## Step 3 — Add Your EmailJS Keys

1. In your forked repository, open the file `config.js`
2. Replace the placeholder values:

```javascript
const EMAILJS_CONFIG = {
  serviceId:  'service_xxxxxxx',   // ← your Service ID
  templateId: 'template_xxxxxxx',  // ← your Template ID
  publicKey:  'xxxxxxxxxxxx'        // ← your Public Key
};
```

3. Save the file and commit the change

---

## Step 4 — Enable GitHub Pages

1. In your repository, click **Settings**
2. Click **Pages** in the left sidebar
3. Under **Source**, select **main branch** → **/ (root)**
4. Click **Save**
5. Wait 1–2 minutes — GitHub will show you your live URL

Your app is now live at:
```
https://yourusername.github.io/3c-goal-tracker/
```

Bookmark it on your phone. Add it to your home screen for the full app experience.

---

## Adding to Your Phone Home Screen

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
Your goal tracker data will be deleted along with it. This is why the email backup exists — use it regularly.

**How often should I back up?**
After any important session. One tap sends everything to your email as readable text.

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
| Email Backup | ✅ | ✅ | ✅ | ✅ |

**Recommended: Chrome or Edge** for the best voice transcription experience.

---

## EmailJS Free Tier

EmailJS free tier allows **200 emails per month**.

For a personal backup tool this is more than enough — most users send one backup per week or less.

If you need more, EmailJS paid plans start at a low monthly cost. This is your own EmailJS account — 3C Thread To Success has no involvement in or access to your emails.

---

## Troubleshooting

**Voice transcription not working**
- Make sure you are using Chrome or Edge
- Check that microphone permission is allowed for the app in your browser settings

**Email not arriving**
- Check your spam folder
- Confirm your EmailJS Service ID, Template ID, and Public Key are correct in `config.js`
- Make sure your EmailJS email service is connected and verified

**Data disappeared**
- Browser storage may have been cleared
- Restore from your email backup or JSON file

**App not loading after GitHub Pages setup**
- Wait 2–3 minutes after enabling Pages
- Hard refresh the page (Ctrl+Shift+R on desktop)

---

## Credits

Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica  

*Think it. Do it. Own it.*
