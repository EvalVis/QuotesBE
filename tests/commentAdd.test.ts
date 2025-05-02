import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { start, stop, TestContext } from './setup';

describe('POST /api/quotes/addComment/:quoteId', () => {
    let context: TestContext;

    beforeAll(async () => {
        context = await start();
    });

    afterAll(async () => {
        await stop(context);
    });

  it('should deny access when user is not logged in', async () => {
    const response = await request(context.app)
      .post(`/api/quotes/addComment/${new ObjectId().toString()}`)
      .send({ comment: 'Sup' })
      .expect(401);

    expect(response.body).toEqual({ message: 'Unauthorized.' });
  });

  it('should return bad request when username is not provided', async () => {
    await request(context.app)
      .post(`/api/quotes/addComment/${new ObjectId().toString()}`)
      .set('Authorization', 'Bearer sub0')
      .send({ comment: 'Sup' })
      .expect(400);
  });

  it('should return bad request when comment is not provided', async () => {
    await request(context.app)
      .post(`/api/quotes/addComment/${new ObjectId().toString()}`)
      .set('Authorization', 'Bearer sub0;tester')
      .send({})
      .expect(400);
  });

  it('should create a comment when all required input is provided', async () => {
    const quoteId = new ObjectId();
    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D']
    });

    await request(context.app)
      .post(`/api/quotes/addComment/${quoteId.toString()}`)
      .set('Authorization', 'Bearer sub0;tester')
      .send({ comment: 'Test comment' })
      .expect(200);

    const quote = await context.db.collection('Quotes').findOne({ _id: quoteId });
    expect(quote).toBeTruthy();
    expect(quote!.comments).toHaveLength(1);
    const comment = quote!.comments[0];
    expect(comment).toHaveProperty('_id');
    expect(comment).toHaveProperty('createdAt');
    expect(comment.sub).toBe('sub0');
    expect(comment.username).toBe('tester');
    expect(comment.text).toBe('Test comment');
  });
});