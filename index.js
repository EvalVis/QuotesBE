const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const customClaimsNamespace = process.env.jwt_customClaimsNamespace;

const optionalJwtCheck = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return next();
  }
  jwtCheck(req, res, next);
}

const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: process.env.jwt_cache || true,
    rateLimit: process.env.jwt_rateLimit || true,
    jwksRequestsPerMinute: process.env.jwt_jwksRequestsPerMinute || 5,
    jwksUri: process.env.jwt_jwksUri
  }),
  audience: process.env.jwt_audience,
  issuer: process.env.jwt_issuer,
  algorithms: process.env.jwt_algorithms ? process.env.jwt_algorithms.split(',') : ['RS256']
});

const client = new MongoClient(process.env.MONGODB_ATLAS_QUOTES_URL);
let quotesCollection;
let usersCollection;

connectToMongo();

async function connectToMongo() {
  await client.connect();
  const database = client.db(process.env.db_name);
  quotesCollection = database.collection(process.env.db_quotesCollectionName);
  usersCollection = database.collection(process.usersCollectionName);
}

app.use((err, _, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  next(err);
});

app.get('/api/quotes/random', optionalJwtCheck, async (req, res) => {
  const sub = req.auth?.sub;

  let excludedQuoteIds = [];
  if (sub) {
    const user = await usersCollection.findOne({ sub });
    if (user && user.savedQuotes) {
      excludedQuoteIds = user.savedQuotes.map(q => ObjectId.createFromHexString(q.quoteId));
    }
  }
  
  const result = await quotesCollection.aggregate([
    { $match: { _id: { $nin: excludedQuoteIds } } },
    { $sample: { size: process.env.quotes_randomFetchSize || 5 } },
    { $project: { comments: 0 } }
  ]).toArray();
  
  res.json(result);
});

app.post('/api/quotes/save/:quoteId', jwtCheck, async (req, res) => {
  try {
    const sub = req.auth.sub;
    const { quoteId } = req.params;
    
    if (!sub || !quoteId) {
      return res.status(400).json({ message: 'User ID and quoteId are required' });
    }
    
    await usersCollection.updateOne(
      {
        sub,
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
    const sub = req.auth.sub;
    if (!sub) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const user = await usersCollection.findOne({ sub });
    
    if (!user || !user.savedQuotes) {
      return res.json([]);
    }

    const quoteIds = user.savedQuotes.map(q => ObjectId.createFromHexString(q.quoteId));
    const quotes = await quotesCollection.find(
      { _id: { $in: quoteIds } },
      { projection: { comments: 0 } }
    ).toArray();

    const quotesMap = new Map(quotes.map(q => [q._id.toString(), q]));
    const result = user.savedQuotes.map(sq => {
      return { ...quotesMap.get(sq.quoteId), dateSaved: sq.dateSaved };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).send();
  }
});

app.delete('/api/quotes/forget/:quoteId', jwtCheck, async (req, res) => {
  try {
    const sub = req.auth.sub;
    const { quoteId } = req.params;
    
    if (!sub || !quoteId) {
      return res.status(400).json({ message: 'User ID and quoteId are required' });
    }
    
    await usersCollection.updateOne(
      { sub },
      { $pull: { savedQuotes: { quoteId } } }
    );
    
    res.status(200).send();
  } catch (error) {
    res.status(500).send();
  }
});

app.post('/api/quotes/addComment/:quoteId', jwtCheck, async (req, res) => {
  const sub = req.auth.sub;
  const username = req.auth[`${customClaimsNamespace}username`];
  const { quoteId } = req.params;
  const { comment } = req.body;
  
  if (!sub || !username || !quoteId || !comment) {
    return res.status(400).json({ message: 'User ID, username, quoteId, and comment are required' });
  }
  
  await quotesCollection.updateOne(
    { _id: ObjectId.createFromHexString(quoteId) },
    { 
      $push: { 
        comments: {
          _id: new ObjectId(),
          sub,
          username,
          text: comment,
          createdAt: new Date()
        } 
      }
    }
  );
  
  res.status(200).send();
});

app.get('/api/quotes/comments/:quoteId', optionalJwtCheck, async (req, res) => {
  const sub = req.auth?.sub;
  const { quoteId } = req.params;
  
  if (!quoteId) {
    return res.status(400).json({ message: 'quoteId is required' });
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
      username: comment.username,
      isOwner: comment.sub === sub,
      createdAt: comment.createdAt
    };
  });
  
  res.json(comments);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 