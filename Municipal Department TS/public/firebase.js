import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "Hide for security reasons",
  authDomain: "municipal-department-ts.firebaseapp.com",
  projectId: "municipal-department-ts",
  storageBucket: "municipal-department-ts.firebasestorage.app",
  messagingSenderId: "Hide for security reasons",
  appId: "Hide for security reasons",
  measurementId: "Hide for security reasons"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };