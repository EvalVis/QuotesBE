import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { start, stop, TestContext } from './setup';

describe('DELETE /api/quotes/forget/:quoteId', () => {
    let context: TestContext;

    beforeAll(async () => {
        context = await start();
    });

    afterAll(async () => {
        await stop(context);
    });

    it('should deny access when user is not logged in', async () => {
        const response = await request(context.app)
            .delete('/api/quotes/forget/not-important')
            .expect(401);

        expect(response.body).toEqual({ message: 'Unauthorized.' });
    });

    it('should remove quote from saved list when user is logged in and provides quoteId', async () => {
        const quoteId = new ObjectId();
        await context.db.collection('Users').insertOne({
            sub: 'sub0',
            savedQuotes: [{ quoteId: quoteId.toString(), dateSaved: new Date() }]
        });

        await request(context.app)
            .delete(`/api/quotes/forget/${quoteId.toString()}`)
            .set('Authorization', 'Bearer sub0')
            .expect(200);

        const user = await context.db.collection('Users').findOne({ sub: 'sub0' });
        expect(user).toBeTruthy();
        expect(user!.savedQuotes).toBeDefined();
        expect(user!.savedQuotes).toHaveLength(0);
    });
});