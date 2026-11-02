# Put your private Lighter app on your iPhone

You do not need to run commands or edit code. There are two account steps that only you can complete: choosing a website host and authorising Fitbit. We can guide you through one screen at a time.

## What is ready, and what is still needed

The app and its deployment instructions are prepared. It is not online yet. Its code currently exists in this development workspace; it must first be saved to your `lawrencecirocco-dotcom/WeighLoss` GitHub repository before a hosting service can download it.

Publishing a **Codex cloud environment** saves the development machine. It does **not** publish your website or create an address for your iPhone.

A personal hosted copy needs:

- A website address beginning with `https://`.
- Your own private Lighter password.
- Storage that keeps your diary and photos when the website restarts.
- Your permission to read Fitbit data.
- Optional AI API access for meal-photo estimates and personalised snacks.

No service has been purchased or activated for you. Hosting and AI can have separate charges. Review the provider's current price before choosing a plan; this guide does not quote an unverified price.

## 1. Create the private website

The prepared hosting option is [Render](https://render.com/). It provides a website address and a persistent storage disk, so you do not need to buy a domain name.

1. Create or sign into your own Render account. Connecting it to the GitHub account that owns this project makes the next step easier.
2. Once the project code has been saved to GitHub, choose **New → Blueprint** in Render and select `lawrencecirocco-dotcom/WeighLoss`.
3. Render should find the prepared `render.yaml`. Review the web service and its **Starter** plan with a **1 GB persistent disk**. Check the price Render shows before continuing. A free service without persistent storage is not the prepared option for your personal diary.
4. In the required `APP_PASSWORD` box, choose a unique password with at least **12 characters**. Save it in your password manager. Enter it only in Render and your private Lighter sign-in screen, never in this chat.
5. Render generates `DATA_ENCRYPTION_KEY` automatically. Keep that value unchanged: it protects the saved connection keys. Do not share it or replace it while the app has connected accounts.
6. When you are happy with the displayed charges, create the service. Wait for the status to become **Live**. If it fails, share the error text with us after removing any secret values.
7. Open the website address Render gives you. Sign in using your Lighter password.

The project uses a persistent disk, so the personal service has one running instance. Render owns its availability and billing. Backups are still important; do not delete the service or disk to troubleshoot a connection problem.

## 2. Connect Fitbit from your private app

Fitbit requires an application registration before it lets a new app read your data. We will help with the labels on that form; you do not need to understand the code.

1. In Lighter, open the connection/setup screen and choose Fitbit. It shows the exact **callback/redirect address** to copy.
2. Open [the Fitbit developer portal](https://dev.fitbit.com/) and sign into the account associated with your Fitbit. The current portal must allow you to register a personal application; account eligibility and provider availability still need to be checked with your real account.
3. Register the application using the public address of your Lighter website. Where asked for a callback or redirect URL, paste the exact address shown inside Lighter. Do not use a made-up address or the earlier localhost development address.
4. Fitbit provides an application **Client ID** and **Client Secret**. Enter them directly into your signed-in Lighter connection screen. Do not post either value in chat or send screenshots showing the secret.
5. Choose **Connect Fitbit**. Fitbit asks you to sign in and approve access. You can read and approve the permissions yourself.
6. Return to Lighter and sync your day. We will check actual steps, workouts, calories and latest weight against your Fitbit account.

A successful real sync is the point at which the connection is verified. A settings screen saying “configured” alone does not prove it works. This first integration imports daily data on demand, not every historical or intraday Fitbit record.

## 3. Turn on AI, if you want it

Manual food logging works without AI. Photo estimation and personalised snack explanations need a separate AI API account and can incur usage charges; a ChatGPT subscription does not automatically supply API credit.

1. Create or sign into your account on [the OpenAI API platform](https://platform.openai.com/).
2. Review its billing and usage controls before adding credit or a payment method. We can help choose a small initial limit, but no purchase has been made for you.
3. Create an API key. Enter it directly into the AI connection screen of your private Lighter app; never paste it into chat.
4. Try a meal photo. Lighter will show an estimate for you to check before saving the food.

A camera cannot measure every portion or hidden ingredient. The final confirmation is always yours.

## 4. Add it to your iPhone Home Screen

Once your private website works:

1. Open its `https://` address in **Safari** on your iPhone.
2. Tap **Share** (the square with the upward arrow).
3. Choose **Add to Home Screen**. You may need to scroll through the actions first.
4. If Safari shows **Open as Web App**, leave it turned on.
5. Tap **Add**. The Lighter sprout icon appears on your Home Screen.

Open that icon to use Lighter in its own app window. It is your private web app; no App Store installation is required. Keep your iPhone protected with a passcode or Face ID.

You need an internet connection to sign in and access private records. Only the public interface is cached; diary records, uploaded body photos, connection secrets and API responses are excluded from the app's offline cache.

## A few clear limits

- 7pm reminders currently work while the app is open. Closed-phone push reminders are a separate feature, and adding the Home Screen icon does not create them automatically.
- Do not share your Lighter password. This first hosted version is for your personal use, not separate accounts for friends or family.
- Keep copies of your original body photos and arrange a backup of the saved app data. The prepared storage disk survives normal app restarts, but it is not a backup by itself.
- The hosting provider's dashboard is where you manage your plan and secure host settings. You do not need to publish this development environment to create a Fitbit connection.
