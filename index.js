const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: 'https://dev-wzfkg4o26oz6ndmt.us.auth0.com/.well-known/jwks.json'
  }),
  audience: 'https://quotesapi.fly.dev',
  issuer: 'https://dev-wzfkg4o26oz6ndmt.us.auth0.com/',
  algorithms: ['RS256']
});

const client = new MongoClient(process.env.MONGODB_ATLAS_QUOTES_URL);
let quotesCollection;

connectToMongo();

async function connectToMongo() {
  await client.connect();
  const database = client.db('Quotes');
  quotesCollection = database.collection('Quotes');
}

app.get('/', (_, res) => {
  res.send('test');
});

app.use((err, _, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  next(err);
});

app.get('/api/quotes/random', jwtCheck, async (_, res) => {
  try {
    const result = await quotesCollection.aggregate([
      { $sample: { size: 5 } }
    ]).toArray();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 