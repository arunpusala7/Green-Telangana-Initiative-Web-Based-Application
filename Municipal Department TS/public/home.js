import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const userEmail = document.getElementById('userEmail');
const complaintButton = document.getElementById('complaintButton');
const complaintForm = document.getElementById('complaintForm');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const preview = document.getElementById('preview');
const takePhotoButton = document.getElementById('takePhotoButton');
const uploadButton = document.getElementById('uploadButton');
const photoUpload = document.getElementById('photoUpload');
const description = document.getElementById('description');
const villageInput = document.getElementById('villageInput');
const districtInput = document.getElementById('districtInput');
const pinCodeInput = document.getElementById('pinCodeInput');
const landmarkInput = document.getElementById('landmarkInput');
const useCurrentLocation = document.getElementById('useCurrentLocation');
const verifyLocationButton = document.getElementById('verifyLocationButton');
const confirmLocationButton = document.getElementById('confirmLocationButton');
const submitComplaint = document.getElementById('submitComplaint');
const cancelButton = document.getElementById('cancelButton');
const message = document.getElementById('message');
const locationPreview = document.getElementById('locationPreview');
const logoutButton = document.getElementById('logoutButton');

const GOOGLE_API_KEY = 'AIzaSyD-x0qgL135VmquGWxNvRnAdssVCT88I2E';
const DEFAULT_LOCATION = { latitude: 28.6139, longitude: 77.2090, formatted: 'New Delhi, India' };

let stream = null;
let selectedLocation = null;
let currentMap = null;
let currentMarker = null;

function compressImage(dataUrl, maxWidth = 600, quality = 0.5) {
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

async function geocodeLocation(village, district, pinCode, landmark = '') {
  try {
    const pinCodeNum = pinCode.trim();
    if (!/^\d{6}$/.test(pinCodeNum)) {
      throw new Error('Pin code must be a 6-digit number.');
    }
    if (!village || !district) {
      throw new Error('Village and district cannot be empty.');
    }

    const address = landmark
      ? `${landmark}, ${village}, ${district}, India, ${pinCodeNum}`
      : `${village}, ${district}, India, ${pinCodeNum}`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}&region=in`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocoding HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('Google Geocoding Response:', data);

    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return {
        latitude: lat,
        longitude: lng,
        confidence: data.results[0].geometry.location_type === 'ROOFTOP' ? 0.9 : 0.7,
        formatted: data.results[0].formatted_address
      };
    }
    throw new Error('Unable to find precise location.');
  } catch (error) {
    console.error('Google Geocoding Error:', error.message);
    return { ...DEFAULT_LOCATION, confidence: 0, source: 'default' };
  }
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Reverse geocoding HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('Google Reverse Geocoding Response:', data);
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return DEFAULT_LOCATION.formatted;
  } catch (error) {
    console.error('Google Reverse Geocoding Error:', error.message);
    return DEFAULT_LOCATION.formatted;
  }
}

async function getTimeZone(latitude, longitude) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Time Zone HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('Time Zone Response:', data);
    if (data.status === 'OK') {
      return data.timeZoneId;
    }
    return 'Asia/Kolkata'; // Default to India timezone
  } catch (error) {
    console.error('Time Zone Error:', error.message);
    return 'Asia/Kolkata';
  }
}

async function getElevation(latitude, longitude) {
  try {
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Elevation HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('Elevation Response:', data);
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].elevation;
    }
    return null;
  } catch (error) {
    console.error('Elevation Error:', error.message);
    return null;
  }
}

async function getCurrentLocation() {
  try {
    const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) throw new Error(`Geolocation HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('Geolocation Response:', data);
    if (data.location) {
      return { latitude: data.location.lat, longitude: data.location.lng, accuracy: data.accuracy };
    }
    throw new Error('Unable to get current location.');
  } catch (error) {
    console.error('Geolocation Error:', error.message);
    return null;
  }
}

function initializeLocationPreview(latitude, longitude, address) {
  console.log('Initializing Google Map:', { latitude, longitude, address });
  if (!locationPreview) {
    console.error('locationPreview element not found');
    message.className = 'error';
    message.textContent = 'Error: Map container not found.';
    return;
  }
  locationPreview.style.display = 'block';
  locationPreview.innerHTML = '';

  try {
    currentMap = new google.maps.Map(locationPreview, {
      center: { lat: latitude, lng: longitude },
      zoom: 15,
      mapTypeId: 'hybrid', // Satellite + labels for better visibility
      styles: [
        { featureType: 'all', stylers: [{ saturation: 20 }, { lightness: 20 }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ hue: '#388e3c' }] },
        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] }
      ]
    });
    currentMarker = new google.maps.Marker({
      position: { lat: latitude, lng: longitude },
      map: currentMap,
      draggable: true,
      title: address,
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }
    });

    currentMarker.addListener('dragend', async () => {
      const position = currentMarker.getPosition();
      selectedLocation.latitude = position.lat();
      selectedLocation.longitude = position.lng();
      selectedLocation.source = 'user-adjusted';
      const newAddress = await reverseGeocode(position.lat(), position.lng());
      message.className = 'success';
      message.textContent = `Location adjusted: ${newAddress}`;
      console.log('Marker Dragged:', { latitude: position.lat(), longitude: position.lng(), address: newAddress });
    });

    const streetView = new google.maps.StreetViewPanorama(locationPreview, {
      position: { lat: latitude, lng: longitude },
      visible: false
    });
    currentMap.setStreetView(streetView);
    const toggleStreetViewButton = document.createElement('button');
    toggleStreetViewButton.textContent = 'Toggle Street View';
    toggleStreetViewButton.style.cssText = 'position: absolute; top: 10px; left: 10px; padding: 5px; background-color: #388e3c; color: white; border: none; border-radius: 5px;';
    locationPreview.appendChild(toggleStreetViewButton);
    toggleStreetViewButton.addEventListener('click', () => {
      const isStreetViewVisible = streetView.getVisible();
      streetView.setVisible(!isStreetViewVisible);
      locationPreview.style.display = isStreetViewVisible ? 'block' : 'none';
      if (!isStreetViewVisible) {
        locationPreview.style.display = 'block';
        currentMap.setCenter({ lat: latitude, lng: longitude });
      }
    });
  } catch (mapError) {
    console.error('Google Map Initialization Error:', mapError.message);
    message.className = 'error';
    message.textContent = 'Error loading map: ' + mapError.message;
  }
}

function initializeAutocomplete() {
  try {
    const villageAutocomplete = new google.maps.places.Autocomplete(villageInput, {
      types: ['(regions)'],
      componentRestrictions: { country: 'in' }
    });
    const districtAutocomplete = new google.maps.places.Autocomplete(districtInput, {
      types: ['(regions)'],
      componentRestrictions: { country: 'in' }
    });
    const landmarkAutocomplete = new google.maps.places.Autocomplete(landmarkInput, {
      types: ['establishment'],
      componentRestrictions: { country: 'in' }
    });
    villageAutocomplete.addListener('place_changed', () => {
      const place = villageAutocomplete.getPlace();
      if (place.geometry) villageInput.value = place.name || villageInput.value;
    });
    districtAutocomplete.addListener('place_changed', () => {
      const place = districtAutocomplete.getPlace();
      if (place.geometry) districtInput.value = place.name || districtInput.value;
    });
    landmarkAutocomplete.addListener('place_changed', () => {
      const place = landmarkAutocomplete.getPlace();
      if (place.geometry) landmarkInput.value = place.name || landmarkInput.value;
    });
  } catch (error) {
    console.error('Autocomplete Initialization Error:', error.message);
  }
}

window.initMap = function() {
  console.log('Google Maps API loaded');
  initializeAutocomplete();
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    userEmail.textContent = user.email;

    complaintButton.addEventListener('click', async () => {
      console.log('Complaint Button Clicked');
      complaintForm.style.display = 'block';
      complaintButton.style.display = 'none';
      video.style.display = 'block';
      takePhotoButton.style.display = 'block';
      uploadButton.style.display = 'block';
      photoUpload.style.display = 'block';
      useCurrentLocation.style.display = 'block';
      message.textContent = '';
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log('Camera stream started');
      } catch (error) {
        message.className = 'error';
        message.textContent = 'Error accessing camera: ' + error.message + '. Please upload a photo instead.';
        console.error('Camera Error:', error.message);
        video.style.display = 'none';
        takePhotoButton.style.display = 'none';
      }
    });

    useCurrentLocation.addEventListener('click', async () => {
      console.log('Use Current Location Clicked');
      message.className = '';
      message.textContent = 'Fetching current location...';
      const location = await getCurrentLocation();
      if (location) {
        selectedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          source: 'geolocation',
          gpsAccuracy: location.accuracy,
          geocodeConfidence: null
        };
        const address = await reverseGeocode(location.latitude, location.longitude);
        villageInput.value = address.split(',')[0].trim() || 'Unknown Village';
        districtInput.value = address.split(',')[1].trim() || 'Unknown District';
        pinCodeInput.value = address.match(/\d{6}/)?.[0] || '';
        message.className = 'success';
        message.textContent = `Location detected: ${address}. Verify and adjust if needed.`;
        initializeLocationPreview(location.latitude, location.longitude, address);
        confirmLocationButton.style.display = 'block';
      } else {
        message.className = 'warning';
        message.textContent = 'Unable to detect location. Please enter address manually.';
      }
    });

    takePhotoButton.addEventListener('click', async () => {
      console.log('Take Photo Button Clicked');
      if (!stream) {
        message.className = 'error';
        message.textContent = 'Camera not available. Please upload a photo instead.';
        console.error('No camera stream available');
        return;
      }
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const compressedDataUrl = await compressImage(dataUrl);
        video.style.display = 'none';
        canvas.style.display = 'none';
        preview.src = compressedDataUrl;
        preview.style.display = 'block';
        takePhotoButton.style.display = 'none';
        uploadButton.style.display = 'none';
        photoUpload.style.display = 'none';
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
          console.log('Camera stream stopped');
        }
      } catch (error) {
        message.className = 'error';
        message.textContent = 'Error capturing photo: ' + error.message;
        console.error('Photo Capture Error:', error.message);
      }
    });

    uploadButton.addEventListener('click', async () => {
      console.log('Upload Button Clicked');
      const file = photoUpload.files[0];
      if (!file) {
        message.className = 'error';
        message.textContent = 'Please select a photo to upload.';
        console.error('No file selected for upload');
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const compressedDataUrl = await compressImage(reader.result);
            preview.src = compressedDataUrl;
            preview.style.display = 'block';
            video.style.display = 'none';
            canvas.style.display = 'none';
            takePhotoButton.style.display = 'none';
            uploadButton.style.display = 'none';
            photoUpload.style.display = 'none';
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
              stream = null;
              console.log('Camera stream stopped after upload');
            }
            console.log('Photo uploaded and compressed');
          } catch (error) {
            message.className = 'error';
            message.textContent = 'Error processing uploaded photo: ' + error.message;
            console.error('Photo Upload Error:', error.message);
          }
        };
        reader.onerror = () => {
          message.className = 'error';
          message.textContent = 'Error reading uploaded file.';
          console.error('FileReader Error');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        message.className = 'error';
        message.textContent = 'Error uploading photo: ' + error.message;
        console.error('Upload Error:', error.message);
      }
    });

    verifyLocationButton.addEventListener('click', async () => {
      console.log('Verify Location Button Clicked');
      const village = villageInput.value.trim();
      const district = districtInput.value.trim();
      const pinCode = pinCodeInput.value.trim();
      const landmark = landmarkInput.value.trim();

      if (!village || !district || !pinCode) {
        message.className = 'error';
        message.textContent = 'Please enter village, district, and pin code.';
        console.error('Missing required location fields');
        return;
      }

      message.className = '';
      message.textContent = 'Verifying location...';
      confirmLocationButton.style.display = 'block';

      try {
        const geocodedCoords = await geocodeLocation(village, district, pinCode, landmark);
        selectedLocation = {
          latitude: geocodedCoords.latitude,
          longitude: geocodedCoords.longitude,
          source: geocodedCoords.source || 'geocoded',
          gpsAccuracy: null,
          geocodeConfidence: geocodedCoords.confidence
        };

        const address = await reverseGeocode(selectedLocation.latitude, selectedLocation.longitude);
        message.className = geocodedCoords.source === 'default' ? 'warning' : 'success';
        message.textContent = geocodedCoords.source === 'default'
          ? `Location verification failed, using default location: ${address}. Drag marker to adjust.`
          : `Location verified: ${address}. Drag marker to adjust.`;
        initializeLocationPreview(selectedLocation.latitude, selectedLocation.longitude, address);
      } catch (error) {
        message.className = 'warning';
        message.textContent = `Location verification failed: ${error.message}. Using default location. Drag marker to adjust.`;
        console.error('Verification Error:', error.message);
        selectedLocation = {
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          source: 'default',
          gpsAccuracy: null,
          geocodeConfidence: 0
        };
        initializeLocationPreview(selectedLocation.latitude, selectedLocation.longitude, DEFAULT_LOCATION.formatted);
      }
    });

    confirmLocationButton.addEventListener('click', () => {
      console.log('Confirm Location Button Clicked');
      if (!selectedLocation) {
        message.className = 'error';
        message.textContent = 'No location selected. Please verify location first.';
        console.error('No selected location');
        return;
      }
      message.className = 'success';
      message.textContent = `Location confirmed: Latitude ${selectedLocation.latitude.toFixed(4)}, Longitude ${selectedLocation.longitude.toFixed(4)}`;
      confirmLocationButton.style.display = 'none';
    });

    complaintForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Submit Complaint Form Submitted');
      const desc = description.value.trim();
      const village = villageInput.value.trim();
      const district = districtInput.value.trim();
      const pinCode = pinCodeInput.value.trim();
      const landmark = landmarkInput.value.trim();

      if (!desc) {
        message.className = 'error';
        message.textContent = 'Please enter a description.';
        console.error('Missing description');
        return;
      }
      if (!preview.src) {
        message.className = 'error';
        message.textContent = 'Please capture or upload a photo.';
        console.error('No photo provided');
        return;
      }
      if (!village || !district || !pinCode) {
        message.className = 'error';
        message.textContent = 'Please enter village, district, and pin code.';
        console.error('Missing required location fields');
        return;
      }
      if (!selectedLocation) {
        message.className = 'error';
        message.textContent = 'Please verify and confirm location before submitting.';
        console.error('No confirmed location');
        return;
      }

      try {
        const compressedDataUrl = preview.src;
        const timeZone = await getTimeZone(selectedLocation.latitude, selectedLocation.longitude);
        const elevation = await getElevation(selectedLocation.latitude, selectedLocation.longitude);
        const docRef = await addDoc(collection(db, 'complaints'), {
          userId: user.uid,
          userEmail: user.email,
          description: desc,
          photoBase64: compressedDataUrl,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          village: village,
          district: district,
          pinCode: pinCode,
          landmark: landmark,
          status: 'pending',
          createdAt: new Date(),
          resolvedPhotoBase64: null,
          locationSource: selectedLocation.source,
          gpsAccuracy: selectedLocation.gpsAccuracy,
          geocodeConfidence: selectedLocation.geocodeConfidence,
          timeZone: timeZone,
          elevation: elevation
        });
        console.log('Complaint submitted with ID:', docRef.id);
        message.className = 'success';
        message.textContent = 'Complaint submitted successfully!';
        complaintForm.reset();
        complaintForm.style.display = 'none';
        complaintButton.style.display = 'block';
        preview.style.display = 'none';
        locationPreview.style.display = 'none';
        locationPreview.innerHTML = '';
        if (currentMap) {
          currentMap = null;
        }
        selectedLocation = null;
        confirmLocationButton.style.display = 'none';
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
          console.log('Camera stream stopped after submission');
        }
      } catch (firestoreError) {
        message.className = 'error';
        message.textContent = 'Error submitting complaint to Firestore: ' + firestoreError.message;
        console.error('Firestore Error:', firestoreError.message);
      }
    });

    cancelButton.addEventListener('click', () => {
      console.log('Cancel Button Clicked');
      complaintForm.reset();
      complaintForm.style.display = 'none';
      complaintButton.style.display = 'block';
      video.style.display = 'none';
      canvas.style.display = 'none';
      preview.style.display = 'none';
      takePhotoButton.style.display = 'none';
      uploadButton.style.display = 'none';
      photoUpload.style.display = 'block';
      useCurrentLocation.style.display = 'block';
      locationPreview.style.display = 'none';
      locationPreview.innerHTML = '';
      if (currentMap) {
        currentMap = null;
      }
      message.textContent = '';
      selectedLocation = null;
      confirmLocationButton.style.display = 'none';
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        console.log('Camera stream stopped after cancel');
      }
    });

    logoutButton.addEventListener('click', async () => {
      console.log('Logout Button Clicked');
      try {
        await signOut(auth);
        console.log('User signed out successfully');
        window.location.href = 'index.html';
      } catch (error) {
        message.className = 'error';
        message.textContent = 'Logout error: ' + error.message;
        console.error('Logout Error:', error.message);
      }
    });
  } else {
    console.log('No user logged in, redirecting to login.html');
    window.location.href = 'login.html';
  }
});