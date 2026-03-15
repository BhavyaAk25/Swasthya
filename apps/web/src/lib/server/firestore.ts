import { Firestore } from "@google-cloud/firestore";

import { createInitialState } from "@/lib/server/demo-state";
import type { AppState } from "@/lib/types";

const COLLECTION = "swasthya_demo";
const DOC_ID = "single_user_state";

let firestoreClient: Firestore | null = null;

function getFirestoreClient() {
  if (firestoreClient) {
    return firestoreClient;
  }

  firestoreClient = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });

  return firestoreClient;
}

export function isFirestoreEnabled() {
  return process.env.SWASTHYA_STORE === "firestore";
}

export async function readFirestoreState() {
  try {
    const client = getFirestoreClient();
    const snapshot = await client.collection(COLLECTION).doc(DOC_ID).get();

    if (!snapshot.exists) {
      const state = createInitialState();
      await writeFirestoreState(state);
      return state;
    }

    return snapshot.data() as AppState;
  } catch {
    return createInitialState();
  }
}

export async function writeFirestoreState(state: AppState) {
  const client = getFirestoreClient();
  await client.collection(COLLECTION).doc(DOC_ID).set(state);
}
