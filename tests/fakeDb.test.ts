import { start, stop } from './fakes/fakeDb';
import { Db } from 'mongodb';
import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';

describe('API tests', () => {
  let db: Db;

  beforeAll(async () => {
    db = await start();
  });

  afterAll(async () => {
    await stop();
  });

  it('should fetch random quotes', async () => {
    const quotesCollection = db.collection('Quotes');
    
    await quotesCollection.insertOne({ text: 'Test' });
    
    const insertedQuote = await quotesCollection.findOne({ text: 'Test' });
    expect(insertedQuote).not.toBeNull();
    expect(insertedQuote!.text).toBe('Test');
  });
});