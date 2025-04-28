const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const namespace = 'https://quotes.programmersdiary.com/';

const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: 'https://dev-wzfkg4o26oz6ndmt.us.auth0.com/.well-known/jwks.json'
  }),
  audience: 'quotes.programmersdiary.com',
  issuer: 'https://dev-wzfkg4o26oz6ndmt.us.auth0.com/',
  algorithms: ['RS256']
});

const client = new MongoClient(process.env.MONGODB_ATLAS_QUOTES_URL);
let quotesCollection;
let usersCollection;

connectToMongo();

async function connectToMongo() {
  await client.connect();
  const database = client.db('Quotes');
  quotesCollection = database.collection('Quotes');
  usersCollection = database.collection('Users');
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

app.get('/api/quotes/random', jwtCheck, async (req, res) => {
  try {
    const email = req.auth[`${namespace}email`];
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const user = await usersCollection.findOne({ email });

    let excludedQuoteIds = [];
    if (user && user.savedQuotes) {
      excludedQuoteIds = user.savedQuotes.map(q => ObjectId.createFromHexString(q.quoteId));
    }
    
    const result = await quotesCollection.aggregate([
      { $match: { _id: { $nin: excludedQuoteIds } } },
      { $sample: { size: 5 } },
      { $project: { comments: 0 } }
    ]).toArray();
    
    res.json(result);
  } catch (error) {
    res.status(500).send();
  }
});

app.post('/api/quotes/save/:quoteId', jwtCheck, async (req, res) => {
  try {
    const email = req.auth[`${namespace}email`];
    const { quoteId } = req.params;
    
    if (!email || !quoteId) {
      return res.status(400).json({ message: 'Email and quoteId are required' });
    }
    
    await usersCollection.updateOne(
      {
        email,
        savedQuotes: { $not: { $elemMatch: { quoteId: quoteId } } }
      },
      {
        $push: { savedQuotes: { quoteId, dateSaved: new Date() } }
      },
      { upsert: true }
    );
    
    res.status(200).send();
  } catch (error) {
    res.status(500).send();
  }
});

app.get('/api/quotes/saved', jwtCheck, async (req, res) => {
  try {
    const email = req.auth[`${namespace}email`];
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const user = await usersCollection.findOne({ email });
    
    if (!user || !user.savedQuotes) {
      return res.json([]);
    }
    
    const sortedSavedQuotes = [...user.savedQuotes].sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));

    const quoteIds = sortedSavedQuotes.map(q => ObjectId.createFromHexString(q.quoteId));
    const quotes = await quotesCollection.find(
      { _id: { $in: quoteIds } },
      { projection: { comments: 0 } }
    ).toArray();

    const quotesMap = new Map(quotes.map(q => [q._id.toString(), q]));
    const result = sortedSavedQuotes.map(sq => {
      return { ...quotesMap.get(sq.quoteId), dateSaved: sq.dateSaved };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).send();
  }
});

app.delete('/api/quotes/forget/:quoteId', jwtCheck, async (req, res) => {
  try {
    const email = req.auth[`${namespace}email`];
    const { quoteId } = req.params;
    
    if (!email || !quoteId) {
      return res.status(400).json({ message: 'Email and quoteId are required' });
    }
    
    await usersCollection.updateOne(
      { email },
      { $pull: { savedQuotes: { quoteId } } }
    );
    
    res.status(200).send();
  } catch (error) {
    res.status(500).send();
  }
});

app.post('/api/quotes/addComment/:quoteId', jwtCheck, async (req, res) => {
  const email = req.auth[`${namespace}email`];
  const { quoteId } = req.params;
  const { comment } = req.body;
  
  if (!email || !quoteId || !comment) {
    return res.status(400).json({ message: 'Email, quoteId, and comment are required' });
  }
  
  await quotesCollection.updateOne(
    { _id: ObjectId.createFromHexString(quoteId) },
    { 
      $push: { 
        comments: {
          email,
          text: comment,
          createdAt: new Date()
        } 
      }
    }
  );
  
  res.status(200).send();
});

app.get('/api/quotes/comments/:quoteId', jwtCheck, async (req, res) => {
  const email = req.auth[`${namespace}email`];
  const username = req.auth[`${namespace}username`];
  const { quoteId } = req.params;
  
  if (!email || !quoteId  || !username) {
    return res.status(400).json({ message: 'Email, quoteId and username are required' });
  }
  
  const quote = await quotesCollection.findOne(
    { _id: ObjectId.createFromHexString(quoteId) },
    { projection: { comments: 1 } }
  );
  
  if (!quote) {
    return res.status(404).send();
  }

  if (!quote.comments) {
    return res.json([]);
  }
  
  const comments = quote.comments.map(comment => {
    return {
      text: comment.text,
      username: username,
      isOwner: comment.email === email,
      createdAt: comment.createdAt
    };
  });
  
  res.json(comments);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 