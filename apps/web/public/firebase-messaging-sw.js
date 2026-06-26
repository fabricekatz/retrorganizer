/* Firebase Cloud Messaging background handler.
   Public web config — replace the placeholders with your prod project's values
   (Project settings → General → Web app). Keep messagingSenderId in sync. */
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_API_KEY",
  authDomain: "REPLACE_AUTH_DOMAIN",
  projectId: "REPLACE_PROJECT_ID",
  appId: "REPLACE_APP_ID",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Rappel";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, { body, icon: "/favicon.ico" });
});
