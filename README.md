<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/58be2988-d960-4782-a185-d6fd29601305

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Create test users (Firebase Auth + Firestore)

This project can generate test users for each role/profile to make testing easier.

1. Create a Firebase **Service Account** key JSON and keep it safe (do not commit it).
2. Export it as an environment variable and run the seeder:
   `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' npm run seed:test-users`

The script creates users in Firebase Auth and ensures a `users/{uid}` document exists with the correct `role`, `clientProfile`, `clientType`, and credits fields.
