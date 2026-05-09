# Terra

A simple chatbot named Terra with Firebase authentication.

## Features

- User registration and login using Firebase Authentication
- Simple rule-based chatbot
- Responsive design

## Setup

1. Create a Firebase project at https://console.firebase.google.com/

2. Enable Authentication in your Firebase project:
   - Go to Authentication > Sign-in method
   - Enable Email/Password provider
   - Enable Google provider

3. Get your Firebase configuration:
   - Go to Project settings > General > Your apps
   - Click "Add app" and select Web
   - Copy the config object

4. Replace the placeholder config in `script.js` with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-actual-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-actual-sender-id",
    appId: "your-actual-app-id"
};
```

## Running the App

For the most reliable local run, start a small static server from this folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

If login still fails, check the message shown below the form. Common Firebase setup issues are:
- Email/Password is not enabled in Authentication > Sign-in method.
- `localhost` is missing from Authentication > Settings > Authorized domains.
- The account does not exist yet, so use Sign up first.

## Terra Responses

Terra responds to basic greetings and questions:
- "hello" or "hi" → Greeting response
- "how are you" → Status response
- "bye" or "goodbye" → Farewell response
- "name" → Introduction
- "joke" → Tells a random programming/science joke
- "weather" → Weather response
- "meaning of life" → The ultimate answer
- "color" → Favorite color
- "compliment" or "nice" → Gives a compliment
- "who created you" or "who made you" → Creator info
- Anything else → Default response

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Authentication
