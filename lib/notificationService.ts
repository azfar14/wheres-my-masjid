"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseApp, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";

export type NotificationSetupResult = {
  ok: boolean;
  message: string;
  token?: string;
};

function firebaseSwUrl(): string {
  const params = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ""
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

async function tokenDocumentId(token: string): Promise<string> {
  if (crypto?.subtle) {
    const bytes = new TextEncoder().encode(token);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

export function notificationSupportMessage(): string {
  if (typeof window === "undefined") return "Notifications are available only in the browser.";
  if (!isFirebaseConfigured) return "Firebase is not configured.";
  if (!("Notification" in window)) return "This browser does not support web notifications.";
  if (!("serviceWorker" in navigator)) return "This browser does not support service workers.";
  if (!window.isSecureContext) return "Notifications require HTTPS. Deploy to Vercel and test the HTTPS link.";
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return "Add NEXT_PUBLIC_FIREBASE_VAPID_KEY from Firebase Cloud Messaging Web Push certificates.";
  return "Ready";
}

export async function requestFirebaseNotifications(): Promise<NotificationSetupResult> {
  const support = notificationSupportMessage();
  if (support !== "Ready") return { ok: false, message: support };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, message: "Notification permission was not granted." };

    const app = getFirebaseApp();
    const db = getFirebaseDb();
    if (!app || !db) return { ok: false, message: "Firebase app/database is not available." };

    const [{ getMessaging, getToken }] = await Promise.all([import("firebase/messaging")]);
    const registration = await navigator.serviceWorker.register(firebaseSwUrl(), { scope: "/firebase-cloud-messaging-push-scope" });
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) return { ok: false, message: "Firebase did not return a notification token." };

    const id = await tokenDocumentId(token);
    await setDoc(doc(db, "notificationTokens", id), {
      token,
      platform: "web",
      permission: "granted",
      topics: ["jamaat-reminders", "saved-masjid-updates", "jumuah-reminders"],
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { ok: true, message: "Notifications are enabled. This browser token has been saved to Firestore.", token };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Notification setup failed." };
  }
}
