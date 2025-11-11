// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAbEZatmmEbo81AAOuxMBa5iiKhKIN27bI",
  authDomain: "checkmaster-80f5d.firebaseapp.com",
  projectId: "checkmaster-80f5d",
  storageBucket: "checkmaster-80f5d.firebasestorage.app",
  messagingSenderId: "297495878161",
  appId: "1:297495878161:web:fe52ef30382b2df5ad6fb0"
};

// Inicializa o Firebase
export const app = initializeApp(firebaseConfig);

// Exporta instâncias para usar no resto do app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
