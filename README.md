# pinpurity

Pinterest has a weird habit of removing the **filter_genai=true** query

-so I forced it on myself I guess.

## Install

### Option A — Download ZIP:

1. Extract the ZIP to a folder you can find.
2. Open Chrome (or any chromium browser) and go to `chrome://extensions`.
3. Turn on "Developer mode" (top-right).
4. Click "Load unpacked" and select the extracted folder (the folder that contains `manifest.json`).

### Option B — Clone with Git:

```powershell
git clone https://github.com/ftnick/pinpurity.git
# then -> chrome://extensions -> load unpacked and select the cloned folder
```

## Automatic opt-out POST
pinpurity will send a single request to mark a set of AI topic IDs as "opted out" for your account. This runs only when you're logged in and a valid CSRF token is available. It will only be ran once.
You can find your AI recommendations here: https://pinterest.com/edit/gen-ai-interests

> [!WARNING]
> The extension uses your current logged-in session and your CSRF token to make the request on your behalf; it does not transmit your credentials off your machine. Use at your own risk.
