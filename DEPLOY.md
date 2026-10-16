# Putting Story Forge online (beta)

You'll make two free accounts, upload this folder once, and paste in two secrets. About 20–30 minutes.

## Cost
- Render "Starter" server + 1 GB disk: about $7.25/month.
- OpenAI usage: a few cents per chapter. With weekly limits of 30 chapters per tester, 10 active testers is roughly $10–40/month.
- Set a monthly spend limit at platform.openai.com > Settings > Limits so there are no surprises.

## 1. GitHub (where the code lives)
1. Make a free account at github.com.
2. Click **+** (top right) > **New repository**. Name it `story-forge`, choose **Private**, click **Create repository**.
3. On the next page click **uploading an existing file**.
4. Drag in everything inside the **story-forge-upload** folder on your Desktop (the files and the `public` folder), then click **Commit changes**.

## 2. Render (where it runs)
1. Go to render.com and **sign up with GitHub**. Allow it to see your `story-forge` repo.
2. Click **New** > **Blueprint**, pick `story-forge`, and click **Connect**. Render reads `render.yaml` and sets everything up.
3. It asks for two values:
   - **OPENAI_API_KEY**: make a new key at platform.openai.com/api-keys named "Story Forge Beta" and paste it here.
   - **ADMIN_CODE**: make up a long secret phrase only you know (e.g. `iron-wolf-7729-ledger`). This is your admin login.
4. Click **Apply**. Add a card when asked (Starter plan). The first deploy takes a few minutes.
5. When it says **Live**, open the URL Render shows (like `https://story-forge-xxxx.onrender.com`).

## 3. First login and invites
1. On the site, enter your **ADMIN_CODE** as the invite code, and your name.
2. Click **👤** > **Open admin page**.
3. Create an invite code (e.g. "FB group, 15 people") and click **Copy invite link**. Anyone who opens the link gets the code filled in.
4. Read tester feedback on the same admin page.

## On phones
Open the link in Safari (iPhone) or Chrome (Android) > Share/menu > **Add to Home Screen**. It opens like an app.

## Updating later
Upload changed files to the same GitHub repo (drag them in again > Commit). Render redeploys automatically in a couple of minutes. Stories and accounts are kept on the disk and survive updates.

## Weekly limits
Change LIMIT_CHAPTERS, LIMIT_NARRATION, LIMIT_PORTRAITS and LIMIT_IDEAS in Render > your service > Environment. You (admin) have no limits.
