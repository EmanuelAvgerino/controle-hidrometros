// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB3VvZGjMtp-_b_ltvQRBz_f2G0hRUan7o",
  authDomain: "controle-hidrometros.firebaseapp.com",
  projectId: "controle-hidrometros",
  storageBucket: "controle-hidrometros.firebasestorage.app",
  messagingSenderId: "654677897841",
  appId: "1:654677897841:web:cfd150df7f3dd03aada1d0",
  measurementId: "G-JC8Z2PW70M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
