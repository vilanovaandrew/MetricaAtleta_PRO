import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLuK2ArIQErPcvcBTDJnt3eHTG_bA6Ww0",
  authDomain: "metricaatleta.firebaseapp.com",
  projectId: "metricaatleta",
  storageBucket: "metricaatleta.firebasestorage.app",
  messagingSenderId: "855925178503",
  appId: "1:855925178503:web:d938a1cbf9c8d572e2b822",
  measurementId: "G-97NJ1XKN40"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM elements
const authOverlay = document.getElementById("auth-overlay");
const loginScreen = document.getElementById("login-screen");
const pendingScreen = document.getElementById("pending-screen");
const loadingScreen = document.getElementById("auth-loading-screen");
const loginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("pending-email-display");

if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        signInWithPopup(auth, provider).catch(error => {
            console.error("Erro no login", error);
            alert("Erro no login: " + error.message);
        });
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth);
    });
}

// Ensure the overlay is visible initially
if (authOverlay) authOverlay.style.display = "flex";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        if(loginScreen) loginScreen.style.display = "none";
        if(loadingScreen) loadingScreen.style.display = "flex";
        
        // Check Firestore
        const userRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.approved) {
                    // Update status
                    const loadingText = loadingScreen.querySelector("h2");
                    if (loadingText) loadingText.textContent = "Baixando banco de dados seguro do Firebase...";

                    // Fetch app_data chunks from Firestore
                    const querySnapshot = await getDocs(collection(db, "app_data"));
                    if (querySnapshot.empty) {
                        alert("O banco de dados seguro do Firebase ainda está vazio! Por favor, abra 'upload_data.html' localmente para fazer o primeiro upload dos dados.");
                        if (loadingText) loadingText.textContent = "Banco de dados não encontrado no Firebase.";
                        return;
                    }

                    const docs = [];
                    querySnapshot.forEach((docSnap) => {
                        docs.push(docSnap.data());
                    });

                    // Sort by chunkIndex
                    docs.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

                    const allPlayers = [];
                    docs.forEach(d => {
                        if (d.players && Array.isArray(d.players)) {
                            allPlayers.push(...d.players);
                        }
                    });

                    window.PLAYERS_DATA = allPlayers;

                    // Initialize the app logic
                    if (typeof window.initScoutingApp === 'function') {
                        window.initScoutingApp();
                    }

                    // User is approved and data is loaded! Hide overlay.
                    if(authOverlay) authOverlay.style.display = "none";
                } else {
                    // User not yet approved
                    if(loadingScreen) loadingScreen.style.display = "none";
                    if(pendingScreen) pendingScreen.style.display = "flex";
                    if(userEmailDisplay) userEmailDisplay.textContent = user.email;
                }
            } else {
                // First time login! Create document.
                await setDoc(userRef, {
                    name: user.displayName,
                    email: user.email,
                    approved: false,
                    createdAt: new Date().toISOString()
                });
                if(loadingScreen) loadingScreen.style.display = "none";
                if(pendingScreen) pendingScreen.style.display = "flex";
                if(userEmailDisplay) userEmailDisplay.textContent = user.email;
            }
        } catch(e) {
            console.error("Erro ao carregar dados", e);
            if(loadingScreen) loadingScreen.style.display = "none";
            
            if (e.message && e.message.includes("Missing or insufficient permissions")) {
                alert("Erro de permissão no Firebase. Certifique-se de atualizar as Regras do Firestore.");
            } else {
                alert("Erro ao carregar o sistema. Tente novamente.");
            }
            signOut(auth);
        }
    } else {
        // User is signed out
        if(authOverlay) authOverlay.style.display = "flex";
        if(loadingScreen) loadingScreen.style.display = "none";
        if(pendingScreen) pendingScreen.style.display = "none";
        if(loginScreen) loginScreen.style.display = "flex";
    }
});
