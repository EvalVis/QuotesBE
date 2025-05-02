import { start, stop } from './fakes/fakeDb';
import { Db, ObjectId } from 'mongodb';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createApi } from '../src/api';

describe('API tests', () => {
  let db: Db;
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    db = await start();
    app = express();
    app.use(express.json());
    createApi({ mongoDb: db, app });
    server = app.listen(0);
  });

  afterAll(async () => {
    server.close();
    await stop();
  });

  async function seedDatabase() {
    const quotesCollection = db.collection('Quotes');
    const usersCollection = db.collection('Users');
    
    await quotesCollection.deleteMany({});
    await usersCollection.deleteMany({});

    const savedQuoteId = new ObjectId('1'.repeat(24));

    await quotesCollection.insertMany([
      { quote: 'Quote A', _id: new ObjectId(), author: 'Author A', tags: ['tagA', 'tagB'] },
      { quote: 'Quote B', _id: new ObjectId(), author: 'Author B', tags: ['tagC', 'tagA'] },
      { quote: 'Quote C', _id: savedQuoteId, author: 'Author C', tags: ['tagD', 'tagB'] }
    ]);

    await usersCollection.insertOne({
      sub: 'sub0',
      savedQuotes: [ { quoteId: savedQuoteId.toString(), dateSaved: '2025-05-02T10:22:37.527Z' } ]
    });
  }

  describe('GET /api/quotes/random', () => {
    beforeEach(async () => {
      await seedDatabase();
    });

    it('should exclude saved quotes when user is logged in', async () => {
      const response = await request(app)
        .get('/api/quotes/random')
        .set('Authorization', 'Bearer sub0')
        .expect(200);

      const quotes = response.body;
      expect(quotes).toHaveLength(2);
      expect(quotes).not.toContainEqual(expect.objectContaining({ _id: new ObjectId('1'.repeat(24)) }));
    });

    it('should not exclude any quotes when user is logged in but has no saved quotes', async () => {
      const response = await request(app)
        .get('/api/quotes/random')
        .set('Authorization', 'Bearer sub1')
        .expect(200);

      const quotes = response.body;
      expect(quotes).toHaveLength(3);
    });

    it('should not exclude any quotes when user is not logged in', async () => {
      const response = await request(app)
        .get('/api/quotes/random')
        .expect(200);

      const quotes = response.body;
      expect(quotes).toHaveLength(3);
      
      const quoteContents = quotes.map(({ _id, ...rest }: any) => rest);
      expect(quoteContents).toContainEqual({ quote: 'Quote A', author: 'Author A', tags: ['tagA', 'tagB'] });
      expect(quoteContents).toContainEqual({ quote: 'Quote B', author: 'Author B', tags: ['tagC', 'tagA'] });
      expect(quoteContents).toContainEqual({ quote: 'Quote C', author: 'Author C', tags: ['tagD', 'tagB'] });
    });
  });
});