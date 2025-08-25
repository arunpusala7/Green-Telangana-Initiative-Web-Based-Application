import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const registerForm = document.getElementById('registerForm');
const message = document.getElementById('message');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  message.textContent = '';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      role: 'user'
    });

    message.className = 'success';
    message.textContent = 'Registration successful! Redirecting to login...';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
  } catch (error) {
    message.className = 'error';
    message.textContent = 'Error: ' + error.message;
  }
});