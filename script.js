// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDh9cpgXnldh9WriC8fg08scKn8llgPUiU",
    authDomain: "sriyanchatbot.firebaseapp.com",
    projectId:  "sriyanchatbot",
    storageBucket: "sriyanchatbot.appspot.com",
    messagingSenderId:  "295787860335",
    appId: "1:295787860335:web:f4dc1d9ce4e5591052189a",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// DOM elements
const loadingContainer = document.getElementById('loading-container');
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const aboutContainer = document.getElementById('about-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const aboutForm = document.getElementById('about-form');
const loginLink = document.getElementById('login-link');
const signupLink = document.getElementById('signup-link');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const aboutButton = document.getElementById('about-button');
const logoutButton = document.getElementById('logout-button');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const micButton = document.getElementById('mic-button');
const sendButton = document.getElementById('send-button');
const aboutNameInput = document.getElementById('about-name');
const aboutDobInput = document.getElementById('about-dob');
const aboutPhotoInput = document.getElementById('about-photo');
const loginStatus = document.getElementById('login-status');
const signupStatus = document.getElementById('signup-status');
const aboutStatus = document.getElementById('about-status');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const aboutError = document.getElementById('about-error');
const loginButton = loginForm.querySelector('button[type="submit"]');
const signupButton = signupForm.querySelector('button[type="submit"]');
const aboutSubmitButton = aboutForm.querySelector('button[type="submit"]');
const googleLoginButton = document.getElementById('google-login-button');
const googleSignupButton = document.getElementById('google-signup-button');
let greetedUserId = null;
let delayNextChatOpen = false;
let chatOpenTimer = null;
let recognition = null;
let isListening = false;

function showError(element, message) {
    element.textContent = message;
}

function showStatus(element, message) {
    element.textContent = message;
}

function getAuthErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'This email already has an account. Try logging in instead.',
        'auth/invalid-credential': 'Email or password is incorrect. If you used Google before, login with Google.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/invalid-login-credentials': 'Email or password is incorrect.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
        'auth/operation-not-allowed': 'Email/password login is not enabled in Firebase Authentication.',
        'auth/operation-not-supported-in-this-environment': 'Google login needs http://localhost:8000 or HTTPS. Do not open index.html directly.',
        'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
        'auth/popup-blocked': 'The browser blocked the Google sign-in popup. Allow popups and try again.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        'auth/unauthorized-domain': 'This domain is not authorized in Firebase Authentication settings.',
        'auth/user-not-found': 'No account found for this email. Sign up first.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/wrong-password': 'Email or password is incorrect.',
    };

    return messages[error.code] || error.message || 'Something went wrong. Please try again.';
}

function setButtonLoading(button, isLoading, loadingText) {
    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        micButton.disabled = true;
        micButton.title = 'Speech recognition is not supported in this browser.';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.addEventListener('start', () => {
        isListening = true;
        micButton.classList.add('is-listening');
        micButton.textContent = '■';
        micButton.setAttribute('aria-label', 'Stop microphone');
    });

    recognition.addEventListener('end', () => {
        isListening = false;
        micButton.classList.remove('is-listening');
        micButton.textContent = '🎙';
        micButton.setAttribute('aria-label', 'Use microphone');
    });

    recognition.addEventListener('result', (event) => {
        const transcript = event.results[0][0].transcript.trim();

        if (transcript) {
            messageInput.value = transcript;
            sendMessage();
        }
    });

    recognition.addEventListener('error', (event) => {
        addMessage(`Microphone error: ${event.error}.`);
    });
}

function getUserNameKey(user) {
    return `chatbotName:${user.uid}`;
}

function getUserDobKey(user) {
    return `chatbotDob:${user.uid}`;
}

function getUserPhotoKey(user) {
    return `chatbotPhoto:${user.uid}`;
}

function getSavedName(user) {
    return user ? localStorage.getItem(getUserNameKey(user)) : null;
}

function getSavedDob(user) {
    return user ? localStorage.getItem(getUserDobKey(user)) : null;
}

function getSavedPhoto(user) {
    return user ? localStorage.getItem(getUserPhotoKey(user)) : null;
}

function hasCompleteProfile(user) {
    return Boolean(getSavedName(user) && getSavedDob(user));
}

function saveUserName(user, name) {
    localStorage.setItem(getUserNameKey(user), name);
}

function saveUserDob(user, dob) {
    localStorage.setItem(getUserDobKey(user), dob);
}

function saveUserPhoto(user, photoDataUrl) {
    if (photoDataUrl) {
        localStorage.setItem(getUserPhotoKey(user), photoDataUrl);
    }
}

function saveUserProfile(user, name, dob, photoDataUrl) {
    const cleanedName = cleanName(name);
    let savedProfile = false;

    if (cleanedName) {
        saveUserName(user, cleanedName);
        savedProfile = true;
    }

    if (dob) {
        saveUserDob(user, dob);
        savedProfile = true;
    }

    if (photoDataUrl) {
        saveUserPhoto(user, photoDataUrl);
        savedProfile = true;
    }

    return savedProfile;
}


function cleanName(name) {
    return name
        .replace(/^my name is\s+/i, '')
        .replace(/^i am\s+/i, '')
        .replace(/^i'm\s+/i, '')
        .trim()
        .slice(0, 40);
}

function openChat(user, delay = false) {
    clearTimeout(chatOpenTimer);

    const show = () => {
        showChat();
        updateAvatar(user);
        showWelcomeMessage(user);
    };

    if (delay) {
        chatOpenTimer = setTimeout(show, 2000);
        return;
    }

    show();
}

function routeAuthenticatedUser(user, forceAbout = false) {
    if (forceAbout || !hasCompleteProfile(user)) {
        showAbout(user);
        return;
    }

    openChat(user);
}

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        routeAuthenticatedUser(user, delayNextChatOpen);
        delayNextChatOpen = false;
    } else {
        // User is signed out
        clearTimeout(chatOpenTimer);
        delayNextChatOpen = false;
        greetedUserId = null;
        chatMessages.innerHTML = '';
        showLogin();
    }
});

// Show login form
function showLogin() {
    loadingContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    signupContainer.style.display = 'none';
    aboutContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    showStatus(loginStatus, '');
    showStatus(signupStatus, '');
    showStatus(aboutStatus, '');
    loginError.textContent = '';
    signupError.textContent = '';
    aboutError.textContent = '';
}

// Show signup form
function showSignup() {
    loadingContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    signupContainer.style.display = 'block';
    aboutContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    showStatus(loginStatus, '');
    showStatus(signupStatus, '');
    showStatus(aboutStatus, '');
    loginError.textContent = '';
    signupError.textContent = '';
    aboutError.textContent = '';
}

// Show about me form
function showAbout(user) {
    loadingContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    signupContainer.style.display = 'none';
    aboutContainer.style.display = 'block';
    chatContainer.style.display = 'none';
    showStatus(loginStatus, '');
    showStatus(signupStatus, '');
    showStatus(aboutStatus, '');
    loginError.textContent = '';
    signupError.textContent = '';
    aboutError.textContent = '';
    aboutNameInput.value = getSavedName(user) || '';
    aboutDobInput.value = getSavedDob(user) || '';
    aboutPhotoInput.value = '';
    aboutNameInput.focus();
}

function updateAvatar(user) {
    const avatar = document.querySelector('.profile-avatar');
    if (!avatar || !user) return;

    const savedPhoto = getSavedPhoto(user);
    if (savedPhoto) {
        avatar.style.backgroundImage = `url('${savedPhoto}')`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
    } else {
        avatar.style.backgroundImage = `radial-gradient(circle at top left, rgba(99, 102, 241, 0.9), transparent 50%)`;
    }
}


// Show chat interface
function showChat() {
    loadingContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    signupContainer.style.display = 'none';
    aboutContainer.style.display = 'none';
    chatContainer.style.display = 'block';
    closeSettingsMenu();
    showStatus(loginStatus, '');
    showStatus(signupStatus, '');
    showStatus(aboutStatus, '');
    loginError.textContent = '';
    signupError.textContent = '';
    aboutError.textContent = '';
    messageInput.focus();
}

function closeSettingsMenu() {
    settingsPanel.classList.remove('is-open');
    settingsButton.setAttribute('aria-expanded', 'false');
}

function toggleSettingsMenu() {
    const isOpen = settingsPanel.classList.toggle('is-open');
    settingsButton.setAttribute('aria-expanded', String(isOpen));
}

function showWelcomeMessage(user) {
    if (!user || greetedUserId === user.uid) {
        return;
    }

    greetedUserId = user.uid;
    chatMessages.innerHTML = '';
    const greetingMessage = 'Hello! I’m glad you’re here. How can I help you today?';

    addMessage(greetingMessage);
    speakText(greetingMessage);
}

async function signInWithGoogle(statusElement, errorElement, button) {
    if (window.location.protocol === 'file:') {
        showStatus(statusElement, 'Opening Terra on localhost...');
        showError(errorElement, '');
        window.location.href = 'http://localhost:8000';
        return;
    }

    try {
        delayNextChatOpen = true;
        setButtonLoading(button, true, 'Opening Google...');
        const credential = await auth.signInWithPopup(googleProvider);
        routeAuthenticatedUser(credential.user, true);
        showStatus(statusElement, 'Please wait...');
        showError(errorElement, '');
    } catch (error) {
        if (
            error.code === 'auth/popup-blocked' ||
            error.code === 'auth/cancelled-popup-request' ||
            error.code === 'auth/operation-not-supported-in-this-environment'
        ) {
            showStatus(statusElement, 'Redirecting to Google...');
            await auth.signInWithRedirect(googleProvider);
            return;
        }

        delayNextChatOpen = false;
        showStatus(statusElement, '');
        showError(errorElement, getAuthErrorMessage(error));
        console.error('Google sign-in error:', error);
    } finally {
        setButtonLoading(button, false);
    }
}

// Login form submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showStatus(loginStatus, '');
        showError(loginError, 'Please enter your email and password.');
        return;
    }

    try {
        delayNextChatOpen = true;
        setButtonLoading(loginButton, true, 'Logging in...');
        const credential = await auth.signInWithEmailAndPassword(email, password);
        loginForm.reset();
        routeAuthenticatedUser(credential.user, true);
        showStatus(loginStatus, 'Please wait...');
        showError(loginError, '');
    } catch (error) {
        delayNextChatOpen = false;
        showStatus(loginStatus, '');
        showError(loginError, getAuthErrorMessage(error));
        console.error('Login error:', error);
    } finally {
        setButtonLoading(loginButton, false);
    }
});

// Signup form submit
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!email || !password) {
        showStatus(signupStatus, '');
        showError(signupError, 'Please enter your email and password.');
        return;
    }

    try {
        delayNextChatOpen = true;
        setButtonLoading(signupButton, true, 'Signing up...');
        const credential = await auth.createUserWithEmailAndPassword(email, password);
        signupForm.reset();
        routeAuthenticatedUser(credential.user, true);
        showStatus(signupStatus, 'Please wait...');
        showError(signupError, '');
    } catch (error) {
        delayNextChatOpen = false;
        showStatus(signupStatus, '');
        showError(signupError, getAuthErrorMessage(error));
        console.error('Signup error:', error);
    } finally {
        setButtonLoading(signupButton, false);
    }
});

// Toggle between login and signup
signupLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSignup();
});

loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
});

googleLoginButton.addEventListener('click', () => {
    signInWithGoogle(loginStatus, loginError, googleLoginButton);
});

googleSignupButton.addEventListener('click', () => {
    signInWithGoogle(signupStatus, signupError, googleSignupButton);
});

aboutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const name = cleanName(aboutNameInput.value);
    const dob = aboutDobInput.value;
    const file = aboutPhotoInput.files[0];

    if (!user) {
        showError(aboutError, 'Please login first.');
        return;
    }

    if (!name || !dob) {
        showStatus(aboutStatus, '');
        showError(aboutError, 'Please enter your name and date of birth.');
        return;
    }

    setButtonLoading(aboutSubmitButton, true, 'Saving...');
    let photoDataUrl = null;

    if (file) {
        photoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read photo file.'));
            reader.readAsDataURL(file);
        }).catch((error) => {
            console.error(error);
            return null;
        });
    }

    saveUserProfile(user, name, dob, photoDataUrl);
    greetedUserId = null;
    showError(aboutError, '');
    showStatus(aboutStatus, 'Please wait... opening chat in 2 seconds.');

    setTimeout(() => {
        setButtonLoading(aboutSubmitButton, false);
        updateAvatar(user);
        openChat(user);
    }, 2000);
});

aboutButton.addEventListener('click', () => {
    closeSettingsMenu();
    showAbout(auth.currentUser);
});

settingsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettingsMenu();
});

settingsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
});

micButton.addEventListener('click', () => {
    if (!recognition) {
        addMessage('Speech recognition is not supported in this browser.');
        return;
    }

    if (isListening) {
        recognition.stop();
        return;
    }

    recognition.start();
});

document.addEventListener('click', (e) => {
    if (!settingsPanel.contains(e.target) && e.target !== settingsButton) {
        closeSettingsMenu();
    }
});

// Logout
logoutButton.addEventListener('click', async () => {
    try {
        logoutButton.disabled = true;
        logoutButton.textContent = 'Logging out...';
        closeSettingsMenu();
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        logoutButton.disabled = false;
        logoutButton.textContent = 'Logout';
    }
});

// Chat functionality
function addMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getMathAnswer(message) {
    const mathExpression = message
        .replace(/what is|calculate|solve|equals|=/gi, '')
        .replace(/plus/gi, '+')
        .replace(/minus/gi, '-')
        .replace(/times|multiplied by|x/gi, '*')
        .replace(/divided by|over/gi, '/')
        .trim();

    if (!/^[\d\s+\-*/().]+$/.test(mathExpression) || !/\d\s*[+\-*/]\s*\d/.test(mathExpression)) {
        return null;
    }

    try {
        const result = Function(`"use strict"; return (${mathExpression});`)();
        return Number.isFinite(result) ? `The answer is ${result}.` : null;
    } catch (error) {
        return null;
    }
}

function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    const currentUser = auth.currentUser;
    const mathAnswer = getMathAnswer(message);

    if (mathAnswer) {
        return mathAnswer;
    }

    if (message.includes('time')) {
        return `The time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }

    if (message.includes('date') || message.includes('day')) {
        return `Today is ${new Date().toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })}.`;
    }

    if (message.includes('population')) {
        if (message.includes('india')) {
            return 'India has about 1.48 billion people in 2026.';
        }

        if (message.includes('world')) {
            return 'The world population is about 8.3 billion people in 2026.';
        }

        return 'I know a few population estimates. Try asking "what is the population of India" or "what is the world population".';
    }

    if (message.includes('joke')) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "I told my computer I needed a break, and now it won't stop sending me Kit Kats.",
            "Why did the programmer quit his job? Because he didn't get arrays.",
            "What do you call a fake noodle? An impasta!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (message.includes('weather')) {
        return 'I don\'t have access to live weather data yet, but I hope it\'s a nice day wherever you are!';
    }

    if (message.includes('meaning of life')) {
        return 'The answer to the ultimate question of life, the universe, and everything is 42.';
    }

    if (message.includes('color')) {
        return 'I like all colors, but #8b5cf6 (a nice shade of purple) is my favorite!';
    }
    
    if (message.includes('compliment') || message.includes('nice')) {
        return 'You are doing a great job! Keep up the good work.';
    }

    if (message.includes('created you') || message.includes('made you') || message.includes('who is your creator')) {
        return 'I was created by Sriyan!';
    }

    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return 'Hello! How can I help you today?';
    }

    if (message.includes('how are you')) {
        return 'I\'m doing well, thank you for asking! How about you?';
    }

    if (message.includes('bye') || message.includes('goodbye')) {
        return 'Goodbye! Have a great day!';
    }

    if (message.includes('my name') || message.includes('who am i')) {
        const savedName = getSavedName(currentUser);

        if (savedName) {
            return `Your name is ${savedName}.`;
        }

        if (currentUser) {
            return 'I do not know your name yet. Add it on the About Me page.';
        }

        return 'I do not know your name yet.';
    }

    if (message.includes('birth') || message.includes('dob')) {
        const savedDob = getSavedDob(currentUser);

        if (savedDob) {
            return `Your date of birth is ${savedDob}.`;
        }

        if (currentUser) {
            return 'I do not know your date of birth yet. Add it on the About Me page.';
        }

        return 'I do not know your date of birth yet.';
    }

    if (message.includes('my email')) {
        return currentUser?.email
            ? `You are logged in as ${currentUser.email}.`
            : 'I cannot see your account details right now.';
    }

    if (message.includes('your name') || message.includes('who are you')) {
        return 'I\'m Terra, your chatbot.';
    }

    if (message.includes('help') || message.includes('what can you do')) {
        return 'You can ask Terra for the time, date, simple math, jokes, weather, population facts, and your logged-in details.';
    }

    if (message.includes('thank')) {
        return 'You\'re welcome!';
    }

    return 'I am Terra, a small built-in chatbot, so I only know some topics: time, date, simple math, jokes, weather, and a few other fun facts.';
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message, true);
        messageInput.value = '';

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Simulate bot response after a short delay
        setTimeout(() => {
            typingIndicator.remove();
            const botResponse = getBotResponse(message);
            addMessage(botResponse);
            speakText(botResponse);
        }, 1200);
    }
}

setupSpeechRecognition();
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
