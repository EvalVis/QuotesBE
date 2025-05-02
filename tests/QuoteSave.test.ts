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

  beforeEach(async () => {
    await db.collection('Quotes').deleteMany({});
    await db.collection('Users').deleteMany({});
  });

  describe('POST /api/quotes/save/:quoteId', () => {
    it('should deny access when user is not logged in', async () => {
      const response = await request(app)
        .post('/api/quotes/save/not-important')
        .expect(401);

      expect(response.body).toEqual({ message: 'Unauthorized.' });
    });

    it('should return bad request when quoteId is not provided', async () => {
      await request(app)
        .post('/api/quotes/save/')
        .set('Authorization', 'Bearer sub0')
        .expect(404);
    });

    it('should save quote when user is logged in and provides valid quoteId', async () => {
      const quoteId = new ObjectId();
      await db.collection('Quotes').insertOne({
        _id: quoteId,
        quote: 'A',
        author: 'B',
        tags: ['C', 'D']
      });

      await request(app)
        .post(`/api/quotes/save/${quoteId.toString()}`)
        .set('Authorization', 'Bearer sub0')
        .expect(200);

      const user = await db.collection('Users').findOne({ sub: 'sub0' });
      expect(user).toBeTruthy();
      expect(user?.savedQuotes).toHaveLength(1);
      expect(user?.savedQuotes[0].quoteId).toBe(quoteId.toString());
      expect(user?.savedQuotes[0].dateSaved).toBeTruthy();
    });
  });
}); 