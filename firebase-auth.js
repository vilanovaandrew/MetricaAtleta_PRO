import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Credenciais Padrão do Acesso Visitante
const DEFAULT_GUEST_USER = "visitante";
const DEFAULT_GUEST_EMAIL = "visitante@metricaatleta.com";
const DEFAULT_GUEST_PASS = "visitante2026";

// DOM elements
const authOverlay = document.getElementById("auth-overlay");
const loginScreen = document.getElementById("login-screen");
const pendingScreen = document.getElementById("pending-screen");
const loadingScreen = document.getElementById("auth-loading-screen");
const loginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("pending-email-display");

// Elementos do Login com Senha / Visitante
const passwordLoginBtn = document.getElementById("password-login-btn");
const guestQuickLoginBtn = document.getElementById("guest-quick-login-btn");
const emailInput = document.getElementById("auth-email-input");
const passwordInput = document.getElementById("auth-password-input");
const authErrorMsg = document.getElementById("auth-error-msg");

function showError(msg) {
    if (authErrorMsg) {
        authErrorMsg.textContent = msg;
        authErrorMsg.style.display = "block";
    } else {
        alert(msg);
    }
}

function hideError() {
    if (authErrorMsg) {
        authErrorMsg.textContent = "";
        authErrorMsg.style.display = "none";
    }
}

function showLoading(msg) {
    if (loginScreen) loginScreen.style.display = "none";
    if (pendingScreen) pendingScreen.style.display = "none";
    if (loadingScreen) {
        const loadingText = loadingScreen.querySelector("h2");
        if (loadingText) loadingText.textContent = msg || "Verificando Acesso...";
        loadingScreen.style.display = "flex";
    }
}

// Fluxo de Autenticação com Email e Senha (inclui Visitante)
async function loginWithCredentials(login, password) {
    let email = (login || "").trim();
    const pass = (password || "").trim();

    if (!email || !pass) {
        showError("Por favor, preencha o login e a senha.");
        return;
    }

    if (!email.includes("@")) {
        email = email.toLowerCase() + "@metricaatleta.com";
    }

    hideError();
    showLoading("Verificando credenciais...");

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        console.warn("Erro no signInWithEmailAndPassword:", err.code, err.message);

        if (loadingScreen) loadingScreen.style.display = "none";
        if (loginScreen) loginScreen.style.display = "flex";

        if (err.code === "auth/operation-not-allowed" || (err.message && err.message.includes("PASSWORD_LOGIN_DISABLED"))) {
            showError("Aviso: O login por E-mail/Senha precisa ser ativado no Firebase Console (Authentication > Sign-in method > E-mail/senha).");
        } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials") {
            showError("Usuário ou senha incorretos.");
        } else if (err.code === "auth/user-not-found") {
            showError("Usuário não cadastrado.");
        } else if (err.code === "auth/too-many-requests") {
            showError("Muitas tentativas. Aguarde alguns instantes.");
        } else {
            showError("Erro ao fazer login: " + err.message);
        }
    }
}

// Listeners
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        hideError();
        signInWithPopup(auth, provider).catch(error => {
            console.error("Erro no login Google", error);
            if (error.code !== "auth/popup-closed-by-user") {
                showError("Erro no login Google: " + error.message);
            }
        });
    });
}

// Clique no botão "Entrar com Senha"
if (passwordLoginBtn) {
    passwordLoginBtn.addEventListener("click", () => {
        const email = emailInput ? emailInput.value : "";
        const pass = passwordInput ? passwordInput.value : "";
        loginWithCredentials(email, pass);
    });
}

// Enter nos inputs de login e senha
if (emailInput) {
    emailInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (passwordInput) passwordInput.focus();
        }
    });
}

if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (passwordLoginBtn) passwordLoginBtn.click();
        }
    });
}

// Clique no botão "Entrar como Visitante"
if (guestQuickLoginBtn) {
    guestQuickLoginBtn.addEventListener("click", () => {
        loginWithCredentials(DEFAULT_GUEST_USER, DEFAULT_GUEST_PASS);
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
        if (loginScreen) loginScreen.style.display = "none";
        if (loadingScreen) {
            const loadingText = loadingScreen.querySelector("h2");
            if (loadingText) loadingText.textContent = "Verificando Acesso...";
            loadingScreen.style.display = "flex";
        }
        
        const isVisitor = (user.email === DEFAULT_GUEST_EMAIL);

        // Check Firestore
        const userRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userRef);
            let isApproved = false;

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.approved || isVisitor) {
                    isApproved = true;
                }
            } else {
                // First time login! Create document.
                try {
                    await setDoc(userRef, {
                        name: isVisitor ? "Visitante Padrão" : (user.displayName || "Usuário"),
                        email: user.email,
                        approved: isVisitor ? true : false,
                        createdAt: new Date().toISOString()
                    });
                } catch(setErr) {
                    console.warn("setDoc fallback:", setErr);
                }
                if (isVisitor) {
                    isApproved = true;
                }
            }

            if (isApproved) {
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
                if (authOverlay) authOverlay.style.display = "none";
            } else {
                // User not yet approved
                if (loadingScreen) loadingScreen.style.display = "none";
                if (pendingScreen) pendingScreen.style.display = "flex";
                if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            }
        } catch(e) {
            console.error("Erro ao carregar dados", e);
            if (loadingScreen) loadingScreen.style.display = "none";
            
            if (e.message && e.message.includes("Missing or insufficient permissions")) {
                alert("Erro de permissão no Firebase. Certifique-se de atualizar as Regras do Firestore para permitir o acesso do visitante.");
            } else {
                alert("Erro ao carregar o sistema: " + e.message);
            }
            signOut(auth);
        }
    } else {
        // User is signed out
        if (authOverlay) authOverlay.style.display = "flex";
        if (loadingScreen) loadingScreen.style.display = "none";
        if (pendingScreen) pendingScreen.style.display = "none";
        if (loginScreen) loginScreen.style.display = "flex";
    }
});
