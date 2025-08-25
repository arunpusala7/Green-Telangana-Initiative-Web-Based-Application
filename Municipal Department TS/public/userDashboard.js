import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const userEmail = document.getElementById('userEmail');
const complaintsList = document.getElementById('complaintsList');
const logoutButton = document.getElementById('logoutButton');

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User logged in:', user.email);
    userEmail.textContent = user.email;
    const q = query(collection(db, 'complaints'), where('userId', '==', user.uid));
    onSnapshot(q, (snapshot) => {
      complaintsList.innerHTML = '';
      if (snapshot.empty) {
        complaintsList.innerHTML = '<p>No complaints found.</p>';
        return;
      }
      snapshot.forEach((doc) => {
        const data = doc.data();
        const complaintDiv = document.createElement('div');
        complaintDiv.className = 'complaint-card';
        complaintDiv.innerHTML = `
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Status:</strong> <span class="status-${data.status}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span></p>
          <img src="${data.photoBase64}" alt="Before Photo">
          ${data.resolvedPhotoBase64 ? `<img src="${data.resolvedPhotoBase64}" alt="After Photo">` : ''}
        `;
        complaintsList.appendChild(complaintDiv);
      });
      console.log('Complaints loaded:', snapshot.size);
    }, (error) => {
      console.error('Firestore query error:', error.message);
      complaintsList.innerHTML = '<p>Error loading complaints: ' + error.message + '</p>';
    });

    logoutButton.addEventListener('click', async () => {
      console.log('Logout Button Clicked');
      try {
        await signOut(auth);
        console.log('User signed out successfully');
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Logout Error:', error.message);
        alert('Logout error: ' + error.message);
      }
    });
  } else {
    console.log('No user logged in, redirecting to login.html');
    window.location.href = 'login.html';
  }
});