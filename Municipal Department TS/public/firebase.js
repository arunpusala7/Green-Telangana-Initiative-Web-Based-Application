import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCAvmVgF58M0agRYPe80e4va3Jn9oarTg",
  authDomain: "municipal-department-ts.firebaseapp.com",
  projectId: "municipal-department-ts",
  storageBucket: "municipal-department-ts.firebasestorage.app",
  messagingSenderId: "58336911713",
  appId: "1:58336911713:web:2f631952e8d57056d8a520",
  measurementId: "G-MRLG2CQMWK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };