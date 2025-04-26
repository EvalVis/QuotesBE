const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

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

app.get('/api/quotes/random', async (_, res) => {
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