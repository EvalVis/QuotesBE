import { MongoClient } from 'mongodb';
import express from 'express';
import cors from 'cors';
import { createApi } from './api';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        [key: string]: any;
      };
    }
  }
}

(async () => {
  const client = new MongoClient(process.env.MONGODB_ATLAS_QUOTES_URL!);
  const mongoDb = await connectToMongo();

  const app = express();

  app.use(express.json());
  app.use(cors());

  createApi({ mongoDb, app });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  async function connectToMongo() {
    await client.connect();
    return client.db(process.env.db_name);
  }
})();