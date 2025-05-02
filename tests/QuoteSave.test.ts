import { ObjectId } from 'mongodb';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import request from 'supertest';
import { start, stop, TestContext } from './setup';

describe('POST /api/quotes/save/:quoteId', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await start();
  });

  afterAll(async () => {
    await stop(context);
  });
  
  it('should deny access when user is not logged in', async () => {
    const response = await request(context.app)
      .post('/api/quotes/save/not-important')
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized.' });
  });

  it('should return bad request when quoteId is not provided', async () => {
    await request(context.app)
      .post('/api/quotes/save/')
      .set('Authorization', 'Bearer sub0')
      .expect(404);
  });

  it('should save quote when user is logged in and provides valid quoteId', async () => {
    const quoteId = new ObjectId();
    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D']
    });

    await request(context.app)
      .post(`/api/quotes/save/${quoteId.toString()}`)
      .set('Authorization', 'Bearer sub0')
      .expect(200);

    const user = await context.db.collection('Users').findOne({ sub: 'sub0' });
    expect(user).toBeTruthy();
    expect(user?.savedQuotes).toHaveLength(1);
    expect(user?.savedQuotes[0].quoteId).toBe(quoteId.toString());
    expect(user?.savedQuotes[0].dateSaved).toBeTruthy();
  });
});