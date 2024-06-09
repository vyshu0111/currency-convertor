const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://<your-database-name>.firebaseio.com'
});

const db = admin.firestore();

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  res.render('index', { convertedAmount: null, error: null });
});

// Login route
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (userSnapshot.empty) {
      res.render('login', { error: 'Invalid username or password' });
      return;
    }

    let validUser = false;
    userSnapshot.forEach(doc => {
      if (doc.data().password === password) {
        validUser = true;
      }
    });

    if (validUser) {
      res.redirect('/');
    } else {
      res.render('login', { error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error(error);
    res.render('login', { error: 'Error occurred during login' });
  }
});

// Signup route
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if the user already exists
    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (!userSnapshot.empty) {
      res.render('signup', { error: 'User already exists' });
      return;
    }

    // Create a new user
    await db.collection('users').add({
      username,
      password // In a real application, ensure to hash the password before storing it
    });
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.render('signup', { error: 'Error occurred during signup' });
  }
});

// Convert route
app.post('/convert', async (req, res) => {
  const { amount, fromCurrency, toCurrency } = req.body;
  try {
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    const rate = response.data.rates[toCurrency];
    if (rate) {
      const convertedAmount = (amount * rate).toFixed(2);
      // Store the conversion result in Firebase
      await db.collection('conversions').add({
        amount,
        fromCurrency,
        toCurrency,
        convertedAmount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      res.render('index', { convertedAmount, error: null });
    } else {
      res.render('index', { convertedAmount: null, error: 'Invalid currency code' });
    }
  } catch (error) {
    console.error(error);
    res.render('index', { convertedAmount: null, error: 'Error occurred during conversion' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
