import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { start, stop, TestContext } from './setup';

describe('GET /api/quotes/saved', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await start();
  });

  afterAll(async () => {
    await stop(context);
  });

  it('should deny access when user is not logged in', async () => {
    const response = await request(context.app)
      .get('/api/quotes/saved')
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized.' });
  });

  it('should not retrieve saved quotes if there are none', async () => {
    const response = await request(context.app)
      .get('/api/quotes/saved')
      .set('Authorization', 'Bearer sub0')
      .expect(200);

    const savedQuotes = response.body;

    expect(savedQuotes).toHaveLength(0);
  });

  it('should retrieve saved quotes when user is logged in', async () => {
    const quoteId = new ObjectId();
    const dateSaved = new Date().toISOString();

    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D'],
      comments: [{ text: 'Comment', username: 'Username', createdAt: new Date() }]
    });

    await context.db.collection('Users').insertOne({
      sub: 'sub0',
      savedQuotes: [{ quoteId: quoteId.toString(), dateSaved }]
    });

    const response = await request(context.app)
      .get('/api/quotes/saved')
      .set('Authorization', 'Bearer sub0')
      .expect(200);

    const savedQuotes = response.body;

    expect(savedQuotes).toHaveLength(1);
    expect(savedQuotes[0]).toEqual({
      _id: quoteId.toString(),
      quote: 'A',
      author: 'B',
      tags: ['C', 'D'],
      dateSaved
    });
    expect(savedQuotes[0].comments).toBeUndefined();
  });
}); 