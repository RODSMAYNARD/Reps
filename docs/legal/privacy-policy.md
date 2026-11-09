# Reps — Privacy Policy

> **DRAFT for review.** Written from what the app actually does today (November 2026). It is not legal advice: have it reviewed before publishing, fill in the items marked `[TODO]`, and keep it in sync when the app changes (new SDKs, social features, wearables).

**Last updated:** [TODO: publication date]

This policy explains what information Reps ("we", "us") collects when you use the Reps app, why, who we share it with, and the choices you have.

**Controller / contact:** [TODO: legal name of the person or company that publishes the app], [TODO: address]. Email: rodrigo.maynard@gmail.com [TODO: use a dedicated support address on your own domain].

## 1. Information you give us

| Data | Why we use it |
|---|---|
| Email address and password | To create and secure your account and to send account emails (welcome, password reset code, account deletion confirmation). Passwords are stored hashed by our authentication provider; we never see them. |
| Profile: username, display name, bio, link, sex, birth year, body weight, preferred units, theme | To personalize the app (for example units and strength comparisons). Sex, birth year and weight are optional. |
| Training data: workouts, sets, weights, reps, times, distances, notes, routines, exercises you create, Trainer program settings (goal, level, equipment, injuries you choose to enter) | This is the core of the service: to save your history, show statistics and records, and build your plan. |
| Body measurements and progress photos | To show your progress. Progress photos are stored in a private storage bucket that only your account can access. |
| Messages you send us (feedback, feature requests, reports) | To answer you and improve the app. |

Injury information you choose to enter is used only to avoid exercises in your plan. Do not enter information you do not want stored.

## 2. Information collected automatically

- **Product analytics (PostHog):** screens you open and actions such as starting or finishing a workout, completing a set, or opening the paywall. Events are linked to a random account ID, **not** to your email. We use this to understand which features work and fix confusing flows. [TODO: if session replay is ever enabled, describe it here and ask consent first.]
- **Crash and error reports (Sentry):** technical details when the app fails (device model, OS version, app version, error trace), linked to the same random account ID.
- **Purchases (RevenueCat):** if you subscribe to Reps Pro, the subscription status and purchase receipts from the App Store / Google Play, linked to the random account ID. We never receive your card details; payments are processed by Apple or Google.
- **Data kept on your device:** the workout in progress, preferences, a cached copy of your data for offline use, and workouts waiting to upload. These stay on your phone until synced or until you log out / delete the app.

We do **not** sell your personal information, and we do not use it for third-party advertising.

## 3. Who we share it with (service providers)

We use these providers to run the app. They process data on our behalf, under their own security and privacy terms:

| Provider | Purpose | Location |
|---|---|---|
| Supabase | Database, authentication, file storage, server functions | Brazil (São Paulo region) |
| PostHog | Product analytics | United States |
| Sentry | Crash and error reporting | United States |
| RevenueCat | Subscription management | United States |
| Resend | Sending account emails | United States |
| Apple / Google | App distribution, payments, push notifications | Global |

We may also disclose information if required by law or to protect the rights and safety of users and Reps.

## 4. International transfers

Your data may be processed outside your country (for example in the United States). Where required (e.g., GDPR, Brazil's LGPD), we rely on the providers' standard contractual clauses or equivalent safeguards. [TODO: confirm each provider's DPA.]

## 5. How long we keep data

We keep your data while your account exists. When you delete your account, your profile, workouts, routines, measurements, notes and progress photos are deleted from our database and storage. Analytics and error records are kept by the providers for their standard retention period [TODO: e.g., 12 months] and are not linked to your email.

## 6. Your choices and rights

- **Edit** your profile and data at any time in the app.
- **Export** your data: Settings → Export Data (CSV or JSON).
- **Delete your account:** Settings → Delete Account. This is permanent.
- **Notifications:** reminders are optional and can be turned off in Settings → Reminders or in your phone settings.
- Depending on where you live (EU/UK GDPR, Brazil LGPD, California CCPA/CPRA), you may have rights to access, correct, delete, port or object to the processing of your data, and to complain to your data protection authority. Contact us at the email above to exercise them.

**Legal bases (GDPR/LGPD):** performing our contract with you (account and training data), legitimate interests (security, crash reports, improving the app), consent where required (optional analytics in regions that require it [TODO: add an in-app consent prompt for EU/UK users before enabling analytics]), and legal obligations.

## 7. Children

Reps is not intended for children under 13 (or under 16 in the EU). We do not knowingly collect their data. If you believe a child has created an account, contact us and we will delete it.

## 8. Security

Data is sent over encrypted connections (HTTPS). Database rows are protected so each account can only read and write its own data, and progress photos are in private storage accessed through temporary links. No system is perfectly secure, so please use a strong, unique password.

## 9. Changes

We will update this page when our practices change and show the new date at the top. For significant changes we will notify you in the app.
