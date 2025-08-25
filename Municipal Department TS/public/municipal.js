import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const userEmail = document.getElementById('userEmail');
const complaintsList = document.getElementById('complaintsList');
const logoutButton = document.getElementById('logoutButton');
const planRouteButton = document.getElementById('planRouteButton');
const routeMap = document.getElementById('routeMap');
const routeInfo = document.getElementById('routeInfo');

const GOOGLE_API_KEY = 'AIzaSyD-x0qgL135VmquGWxNvRnAdssVCT88I2E';

function initializeMap(latitude, longitude, elementId, address) {
  console.log('Initializing Google Map for Municipal Complaint:', { latitude, longitude, elementId, address });
  const mapElement = document.getElementById(elementId);
  if (!mapElement) {
    console.error('Map element not found:', elementId);
    routeInfo.textContent = 'Error: Map container not found.';
    return;
  }
  try {
    const map = new google.maps.Map(mapElement, {
      center: { lat: latitude, lng: longitude },
      zoom: 15,
      mapTypeId: 'hybrid',
      styles: [
        { featureType: 'all', stylers: [{ saturation: 20 }, { lightness: 20 }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ hue: '#388e3c' }] }
      ]
    });
    new google.maps.Marker({
      position: { lat: latitude, lng: longitude },
      map: map,
      title: address,
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }
    });
  } catch (error) {
    console.error('Google Map Initialization Error:', error.message);
    routeInfo.textContent = 'Error loading map: ' + error.message;
  }
}

async function planRoute(locations) {
  if (locations.length < 2) {
    routeInfo.textContent = 'Need at least two pending complaints to plan a route.';
    console.log('Insufficient complaints for routing:', locations.length);
    return;
  }
  try {
    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1, -1).map(loc => ({
      location: { lat: loc.latitude, lng: loc.longitude },
      stopover: true
    }));
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer();
    routeMap.style.display = 'block';
    const map = new google.maps.Map(routeMap, {
      zoom: 10,
      center: { lat: origin.latitude, lng: origin.longitude },
      mapTypeId: 'roadmap'
    });
    directionsRenderer.setMap(map);

    const response = await directionsService.route({
      origin: { lat: origin.latitude, lng: origin.longitude },
      destination: { lat: destination.latitude, lng: destination.longitude },
      waypoints: waypoints,
      optimizeWaypoints: true,
      travelMode: 'DRIVING'
    });

    if (response.status === 'OK') {
      directionsRenderer.setDirections(response);
      const route = response.routes[0];
      let distance = 0;
      route.legs.forEach(leg => {
        distance += leg.distance.value;
      });
      routeInfo.textContent = `Optimized route: ${route.legs.length} stops, ${Math.round(distance / 1000)} km`;
      console.log('Route Planned:', response);
    } else {
      routeInfo.textContent = 'Unable to plan route: ' + response.status;
      console.log('Route Planning Failed:', response.status);
    }
  } catch (error) {
    console.error('Route Planning Error:', error.message);
    routeInfo.textContent = 'Error planning route: ' + error.message;
  }
}

async function getDistances(origin, destinations) {
  try {
    const service = new google.maps.DistanceMatrixService();
    const response = await new Promise((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [{ lat: origin.latitude, lng: origin.longitude }],
        destinations: destinations.map(d => ({ lat: d.latitude, lng: d.longitude })),
        travelMode: 'DRIVING'
      }, (result, status) => {
        if (status === 'OK') resolve(result);
        else reject(new Error(`Distance Matrix error: ${status}`));
      });
    });
    console.log('Distance Matrix Response:', response);
    return response.rows[0].elements.map((e, i) => ({
      ...destinations[i],
      distance: e.distance ? e.distance.value : Infinity
    })).sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Distance Matrix Error:', error.message);
    return destinations;
  }
}

window.initMap = function() {
  console.log('Google Maps API loaded for municipal');
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('User detected:', {
      email: user.email || 'No email',
      uid: user.uid || 'No UID',
      emailVerified: user.emailVerified,
      providerData: user.providerData
    });
    if (user.email && (user.email.toLowerCase().endsWith('@municipal.com') || user.email.toLowerCase().endsWith('@officer.com'))) {
      console.log('Municipal or admin user logged in:', user.email);
      userEmail.textContent = user.email;

      // Check user role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let userRole = 'officer'; // Default to officer
      if (userDoc.exists()) {
        userRole = userDoc.data().role || 'officer';
        console.log('User role:', userRole);
      } else {
        console.error('User document not found for UID:', user.uid);
        alert('Error: User profile not found.');
        window.location.href = 'login.html';
        return;
      }

      const q = query(collection(db, 'complaints'));
      let pendingComplaints = [];
      onSnapshot(q, (snapshot) => {
        complaintsList.innerHTML = '';
        pendingComplaints = [];
        if (snapshot.empty) {
          complaintsList.innerHTML = '<p>No complaints found.</p>';
          console.log('No complaints found');
          return;
        }
        snapshot.forEach((doc) => {
          const data = doc.data();
          const mapId = `map-${doc.id}`;
          const complaintDiv = document.createElement('div');
          complaintDiv.className = 'complaint-card';
          complaintDiv.innerHTML = `
            <p><strong>User:</strong> ${data.userEmail}</p>
            <p><strong>Description:</strong> ${data.description}</p>
            <p><strong>Location:</strong> ${data.village}, ${data.district}, ${data.pinCode}${data.landmark ? ', ' + data.landmark : ''}</p>
            <p><strong>Status:</strong> <span class="status-${data.status}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span></p>
            <p><strong>Elevation:</strong> ${data.elevation ? data.elevation.toFixed(2) + ' meters' : 'N/A'}</p>
            <p><strong>Time Zone:</strong> ${data.timeZone || 'N/A'}</p>
            <img src="${data.photoBase64}" alt="Before Photo">
            ${data.resolvedPhotoBase64 ? `<img src="${data.resolvedPhotoBase64}" alt="After Photo">` : ''}
            <div id="${mapId}" style="width: 100%; height: 200px; margin: 10px 0; border: 1px solid #388e3c; border-radius: 5px;"></div>
            ${data.status === 'pending' ? `
              <input type="file" id="resolvePhoto-${doc.id}" accept="image/*">
              <button onclick="resolveComplaint('${doc.id}')">Resolve</button>
            ` : ''}
            ${userRole === 'admin' ? `
              <button onclick="deleteComplaint('${doc.id}')">Delete</button>
            ` : ''}
          `;
          complaintsList.appendChild(complaintDiv);
          initializeMap(data.latitude, data.longitude, mapId, `${data.village}, ${data.district}`);
          if (data.status === 'pending') {
            pendingComplaints.push({ ...data, id: doc.id });
          }
        });
        console.log('Complaints loaded:', snapshot.size);

        // Reattach route button listener
        planRouteButton.removeEventListener('click', planRouteHandler);
        planRouteButton.addEventListener('click', planRouteHandler);
      }, (error) => {
        console.error('Firestore query error:', error.message, error.code);
        complaintsList.innerHTML = `<p>Error loading complaints: ${error.message} (${error.code})</p>`;
      });

      function planRouteHandler() {
        console.log('Plan Route Button Clicked');
        if (pendingComplaints.length < 2) {
          routeInfo.textContent = 'Need at least two pending complaints to plan a route.';
          console.log('Insufficient complaints for routing:', pendingComplaints.length);
          return;
        }
        getDistances(pendingComplaints[0], pendingComplaints).then(sortedComplaints => {
          planRoute(sortedComplaints);
        }).catch(error => {
          console.error('Route planning failed:', error.message);
          routeInfo.textContent = 'Error planning route: ' + error.message;
        });
      }

      logoutButton.addEventListener('click', async () => {
        try {
          await signOut(auth);
          console.log('User signed out successfully');
          window.location.href = 'index.html';
        } catch (error) {
          console.error('Logout error:', error.message, error.code);
          alert(`Logout error: ${error.message} (${error.code})`);
        }
      });
    } else {
      console.error('Access denied: User email does not end with @municipal.com or @officer.com', {
        email: user.email || 'No email',
        uid: user.uid || 'No UID'
      });
      alert('Access denied: Please log in with a municipal or officer account (@municipal.com or @officer.com).');
      window.location.href = 'login.html';
    }
  } else {
    console.error('No user logged in, redirecting to login.html');
    alert('Please log in to access the municipal dashboard.');
    window.location.href = 'login.html';
  }
});

window.resolveComplaint = async (complaintId) => {
  console.log('Resolve Complaint:', complaintId);
  const fileInput = document.getElementById(`resolvePhoto-${complaintId}`);
  const file = fileInput.files[0];
  if (!file) {
    alert('Please upload a resolved photo.');
    console.error('No resolved photo uploaded for complaint:', complaintId);
    return;
  }
  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const compressedDataUrl = await compressImage(reader.result);
      await updateDoc(doc(db, 'complaints', complaintId), {
        resolvedPhotoBase64: compressedDataUrl,
        status: 'resolved'
      });
      console.log('Complaint resolved:', complaintId);
    };
    reader.onerror = () => {
      console.error('FileReader error for complaint:', complaintId);
      alert('Error reading uploaded file.');
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Resolve Error:', error.message, error.code);
    alert(`Error resolving complaint: ${error.message} (${error.code})`);
  }
};

window.deleteComplaint = async (complaintId) => {
  console.log('Delete Complaint:', complaintId);
  if (!confirm('Are you sure you want to delete this complaint?')) {
    console.log('Complaint deletion cancelled:', complaintId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'complaints', complaintId));
    console.log('Complaint deleted:', complaintId);
  } catch (error) {
    console.error('Delete Error:', error.message, error.code);
    alert(`Error deleting complaint: ${error.message} (${error.code})`);
  }
};

async function compressImage(dataUrl, maxWidth = 600, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image loading failed'));
  });
}