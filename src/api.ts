import express from 'express';
import { ObjectId, Db } from 'mongodb';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import type { Algorithm } from 'jsonwebtoken';

export function createApi({ mongoDb, app }: { mongoDb: Db, app: express.Application }) {

    const customClaimsNamespace = process.env.jwt_customClaimsNamespace;

    const optionalJwtCheck = (req : express.Request, res : express.Response, next : express.NextFunction) => {
        const auth = req.headers.authorization;
        if (!auth) {
            return next();
        }
        jwtCheck(req, res, next);
    }

    const jwtCheck = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: process.env.jwt_cache ? process.env.jwt_cache === 'true' : true,
        rateLimit: process.env.jwt_rateLimit ? process.env.jwt_rateLimit === 'true' : true,
        jwksRequestsPerMinute: process.env.jwt_jwksRequestsPerMinute ? Number(process.env.jwt_jwksRequestsPerMinute) : 5,
        jwksUri: process.env.jwt_jwksUri!
    }),
    audience: process.env.jwt_audience,
    issuer: process.env.jwt_issuer,
    algorithms: process.env.jwt_algorithms? (process.env.jwt_algorithms.split(',') as Algorithm[]) : ['RS256' as Algorithm],
    });

    const quotesCollection = mongoDb.collection(process.env.db_quotesCollectionName!);
    const usersCollection = mongoDb.collection(process.env.db_usersCollectionName!);

    app.use((err: any, _ : any, res: any, next: any) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    next(err);
    });

    app.get('/api/quotes/random', optionalJwtCheck, async (req : express.Request, res : express.Response) : Promise<void> => {
    try {
        const sub = req.auth?.sub;

        let excludedQuoteIds = [];
        if (sub) {
        const user = await usersCollection.findOne({ sub });
        if (user && user.savedQuotes) {
            excludedQuoteIds = user.savedQuotes.map((q: any) => ObjectId.createFromHexString(q.quoteId));
        }
        }
        
        const result = await quotesCollection.aggregate([
        { $match: { _id: { $nin: excludedQuoteIds } } },
        { $sample: { size: parseInt(process.env.quotes_randomFetchSize!, 10) || 5 } },
        { $project: { comments: 0 } }
        ]).toArray();
        
        res.json(result);
    } catch (error) {
        res.status(500).send();
    }
    });

    app.post('/api/quotes/save/:quoteId', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        const { quoteId } = req.params;
        
        if (!sub || !quoteId) {
          res.status(400).json({ message: 'User ID and quoteId are required' });
          return;
        }
        
        await usersCollection.updateOne(
        {
            sub,
            savedQuotes: { $not: { $elemMatch: { quoteId: quoteId } } }
        },
        {
            $push: { savedQuotes: { quoteId, dateSaved: new Date() } } as any
        },
        { upsert: true }
        );
        
        res.status(200).send();
    } catch (error) {
        res.status(500).send();
    }
    });

    app.get('/api/quotes/saved', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        if (!sub) {
          res.status(400).json({ message: 'User ID is required' });
          return;
        }
        
        const user = await usersCollection.findOne({ sub });
        
        if (!user || !user.savedQuotes) {
          res.json([]);
          return;
        }

        const quoteIds = user.savedQuotes.map((q: any) => ObjectId.createFromHexString(q.quoteId));
        const quotes = await quotesCollection.find(
        { _id: { $in: quoteIds } },
        { projection: { comments: 0 } }
        ).toArray();

        const quotesMap = new Map(quotes.map(q => [q._id.toString(), q]));
        const result = user.savedQuotes.map((sq: any) => {
        return { ...quotesMap.get(sq.quoteId), dateSaved: sq.dateSaved };
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).send();
    }
    });

    app.delete('/api/quotes/forget/:quoteId', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        const { quoteId } = req.params;
        
        if (!sub || !quoteId) {
          res.status(400).json({ message: 'User ID and quoteId are required' });
          return;
        }
        
        await usersCollection.updateOne(
        { sub },
        { $pull: { savedQuotes: { quoteId } } } as any
        );
        
        res.status(200).send();
    } catch (error) {
        res.status(500).send();
    }
    });

    app.post('/api/quotes/addComment/:quoteId', jwtCheck, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        const username = req.auth?.[`${customClaimsNamespace}username`];
        const { quoteId } = req.params;
        const { comment } = req.body;
        
        if (!sub || !username || !quoteId || !comment) {
          res.status(400).json({ message: 'User ID, username, quoteId, and comment are required' });
          return;
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
            } as any
        }
        );
        
        res.status(200).send();
    } catch (error) {
        res.status(500).send();
    }
    });

    app.get('/api/quotes/comments/:quoteId', optionalJwtCheck, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        const { quoteId } = req.params;
        
        if (!quoteId) {
            res.status(400).json({ message: 'quoteId is required' });
            return;
        }
        
        const quote = await quotesCollection.findOne(
        { _id: ObjectId.createFromHexString(quoteId) },
        { projection: { comments: 1 } }
        );
        
        if (!quote) {
            res.status(404).send();
            return;
        }

        if (!quote.comments) {
            res.json([]);
            return;
        }
        
        const comments = quote.comments.map((comment: any) => {
        return {
            text: comment.text,
            username: comment.username,
            isOwner: comment.sub === sub,
            createdAt: comment.createdAt
        };
        });
        
        res.json(comments);
    } catch (error) {
        res.status(500).send();
    }
    });

}