// Shared auth helper — prefixed with _ so Vercel doesn't treat it as an endpoint
import admin from "firebase-admin";

let initialized = false;

function initFirebase() {
  if (initialized) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  initialized = true;
}

/**
 * Verify Firebase ID token from Authorization header.
 * Works with Vercel req object (req.headers.authorization).
 */
export async function verifyToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { error: { status: 401, message: "Missing authorization token" } };
  }

  try {
    initFirebase();
    const decoded = await admin.auth().verifyIdToken(token);
    return { userId: decoded.uid };
  } catch (err) {
    return { error: { status: 401, message: "Invalid token", detail: err.message } };
  }
}
