import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { start, stop, TestContext } from './setup';

describe('GET /api/quotes/comments/:quoteId', () => {
  let context: TestContext;

  beforeAll(async () => {
      context = await start();
  });

  afterAll(async () => {
      await stop(context);
  });

  it('should retrieve comments for a quote when user is logged out', async () => {
    const quoteId = new ObjectId();
    const comments = [
      {
        _id: new ObjectId(),
        sub: 'sub0',
        username: 'tester',
        text: 'Comment',
        createdAt: new Date()
      },
      {
        _id: new ObjectId(),
        sub: 'sub1',
        username: 'Someone',
        text: 'Comment two',
        createdAt: new Date()
      }
    ];
    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D'],
      comments: comments
    });

    const response = await request(context.app)
      .get(`/api/quotes/comments/${quoteId.toString()}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: comments[0].text,
          username: comments[0].username,
          isOwner: false,
          createdAt: comments[0].createdAt.toISOString(),
        }),
        expect.objectContaining({
          text: comments[1].text,
          username: comments[1].username,
          isOwner: false,
          createdAt: comments[1].createdAt.toISOString(),
        })
      ])
    );
  });

  it('should report error if quote is not found', async () => {
    const quoteId = new ObjectId();
    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D']
    });

    const response = await request(context.app)
      .get(`/api/quotes/comments/${new ObjectId()}`)
      .expect(404);

    expect(response.body).toEqual({});
  });

  it('should retrieve no comments if there are none', async () => {
    const quoteId = new ObjectId();
    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'A',
      author: 'B',
      tags: ['C', 'D']
    });

    const response = await request(context.app)
      .get(`/api/quotes/comments/${quoteId.toString()}`)
      .expect(200);

    expect(response.body).toHaveLength(0);
  });

  it('should set isOwner true for users own comment when logged in', async () => {
    const quoteId = new ObjectId();

    await context.db.collection('Quotes').insertOne({
      _id: quoteId,
      quote: 'Test Quote',
      author: 'Test Author',
      tags: ['test'],
      comments: [
        {
          _id: new ObjectId(),
          sub: 'sub0',
          username: 'tester',
          text: 'Comment',
          createdAt: new Date()
        },
        {
          _id: new ObjectId(),
          sub: 'otheruser',
          username: 'Someone',
          text: 'Another comment',
          createdAt: new Date()
        }
      ]
    });

    const response = await request(context.app)
      .get(`/api/quotes/comments/${quoteId.toString()}`)
      .set('Authorization', `Bearer sub0;tester`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    
    const testerComment = response.body.find((c: any) => c.username === "tester");
    expect(testerComment).toBeTruthy();
    expect(testerComment.isOwner).toBe(true);

    const otherComment = response.body.find((c: any) => c.username === 'Someone');
    expect(otherComment).toBeTruthy();
    expect(otherComment.isOwner).toBe(false);
  });
});