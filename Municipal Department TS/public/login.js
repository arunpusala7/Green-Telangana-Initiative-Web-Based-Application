import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  message.textContent = '';

  if (!email || !password) {
    message.className = 'error';
    message.textContent = 'Please enter email and password.';
    console.error('Missing email or password');
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('Login successful:', { email: user.email, uid: user.uid, emailVerified: user.emailVerified });

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('User data:', { role: userData.role, email: user.email });
      if (user.email.toLowerCase().endsWith('@municipal.com') || user.email.toLowerCase().endsWith('@officer.com')) {
        if (userData.role === 'admin') {
          console.log('Redirecting to admin.html for admin:', user.email);
          window.location.href = 'admin.html';
        } else if (userData.role === 'officer') {
          console.log('Redirecting to municipal.html for officer:', user.email);
          window.location.href = 'municipal.html';
        } else {
          console.log('Redirecting to home.html for invalid role:', user.email);
          window.location.href = 'home.html';
        }
      } else {
        console.log('Redirecting to home.html for non-municipal/officer email:', user.email);
        window.location.href = 'home.html';
      }
    } else {
      console.error('User document not found for UID:', user.uid);
      message.className = 'error';
      message.textContent = 'Error: User profile not found.';
    }
  } catch (error) {
    console.error('Login error:', error.message, error.code);
    message.className = 'error';
    message.textContent = `Error: ${error.message} (${error.code})`;
  }
});