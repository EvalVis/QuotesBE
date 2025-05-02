import express from 'express';
import { ObjectId, Db } from 'mongodb';
import { optionalJwtCheck, jwtCheck } from './jwt';
import { swaggerUi, specs } from './swagger';

export function createApi({ mongoDb, app }: { mongoDb: Db, app: express.Application }) {

    const customClaimsNamespace = process.env.jwt_customClaimsNamespace;

    const quotesCollection = mongoDb.collection(process.env.db_quotesCollectionName!);
    const usersCollection = mongoDb.collection(process.env.db_usersCollectionName!);

    app.use((err: any, _ : any, res: any, next: any) => {
        if (err.name === 'UnauthorizedError') {
            return res.status(401).json({ message: 'Unauthorized.' });
        }
        next(err);
    });


    /**
     * @swagger
     * /api/quotes/random:
     *   get:
     *     summary: Returns random quotes.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       JWT token authentication is optional. If you are authenticated
     *       your already saved quotes will not appear in the list.
     *       
     *       Does not include quote's comments, to get them please use /api/quotes/comments/:quoteId.
     *     responses:
     *       200:
     *         description: List of random quotes in json, excluding saved quotes (if logged in) and comments.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   _id:
     *                     type: string
     *                     description: Quote's ID - unique.
     *                   quote:
     *                     type: string
     *                     description: The quote.
     *                   author:
     *                     type: string
     *                     description: Quote's author.
     *                   tags:
     *                     type: array
     *                     description: List of tags associated with the quote.
     *             examples:
     *               eg1:
     *                 value:
     *                   - _id: "680d170c46c456731ba3b858"
     *                     quote: "The only limit to our realization of tomorrow is our doubts of today."
     *                     author: "Franklin D. Roosevelt"
     *                     tags:
     *                       - inspiration
     *                       - motivation
     *                   - _id: "680d170c46c456731ba3b859"
     *                     quote: "Success is not final, failure is not fatal: It is the courage to continue that counts."
     *                     author: "Winston Churchill"
     *                     tags:
     *                       - success
     *                       - perseverance
     *       500:
     *         description: Server error.
     */
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

    /**
     * @swagger
     * /api/quotes/save/{quoteId}:
     *   post:
     *     summary: Saves a quote for the authenticated user.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       JWT token authentication is mandatory for service to know which user wants the quote saved.
     *     parameters:
     *       - in: path
     *         name: quoteId
     *         required: true
     *         description: ID of the quote to save.
     *         schema:
     *           type: string
     *           example: 60b8d295f3a1b2c45f87c4c6
     *     responses:
     *       200:
     *         description: Quote successfully saved.
     *       400:
     *         description: User id is not found.
     *       401:
     *         description: Unauthorized - No JWT token was provided.
     *       500:
     *         description: Server error.
     */
    app.post('/api/quotes/save/:quoteId', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth!.sub;
        const { quoteId } = req.params;
        
        if (!sub) {
          res.status(400).json({ message: 'User ID is required' });
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

    /**
     * @swagger
     * /api/quotes/saved:
     *   get:
     *     summary: Returns saved quotes for the authenticated user.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       Returns all quotes saved by the authenticated user, excluding comments.
     * 
     *       JWT token authentication is mandatory.
     *     responses:
     *       200:
     *         description: List of saved quotes for the authenticateduser.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   _id:
     *                     type: string
     *                   quote:
     *                     type: string
     *                   author:
     *                     type: string
     *                   tags:
     *                     type: array
     *                     items:
     *                       type: string
     *                   dateSaved:
     *                     type: string
     *                     format: date-time
     *             examples:
     *               eg1:
     *                 value:
     *                   - _id: "680d170c46c456731ba3b858"
     *                     quote: "The only limit to our realization of tomorrow is our doubts of today."
     *                     author: "Franklin D. Roosevelt"
     *                     tags: [inspiration, motivation]
     *                     dateSaved: "2025-06-07T10:00:00.000Z"
     *       400:
     *         description: Bad request - User ID is not found.
     *       401:
     *         description: Unauthorized - No JWT token was provided.
     *       500:
     *         description: Server error.
     */
    app.get('/api/quotes/saved', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth!.sub;
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

    /**
     * @swagger
     * /api/quotes/forget/{quoteId}:
     *   delete:
     *     summary: Remove a quote from the authenticated user's saved quoteslist.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       JWT token authentication is mandatory.
     * 
     *       Removes the specified quote from the authenticated user's saved list.
     *     parameters:
     *       - in: path
     *         name: quoteId
     *         required: true
     *         description: ID of the quote to remove.
     *         schema:
     *           type: string
     *           example: 60b8d295f3a1b2c45f87c4c6
     *     responses:
     *       200:
     *         description: Quote successfully removed from saved quotes list.
     *       400:
     *         description: User ID is not found.
     *       401:
     *         description: Unauthorized - No JWT token was provided.
     *       500:
     *         description: Server error.
     */
    app.delete('/api/quotes/forget/:quoteId', jwtCheck, async (req : express.Request, res : express.Response): Promise<void> => {
    try {
        const sub = req.auth!.sub;
        const { quoteId } = req.params;
        
        if (!sub) {
          res.status(400).json({ message: 'User ID is required' });
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

    /**
     * @swagger
     * /api/quotes/addComment/{quoteId}:
     *   post:
     *     summary: Add a comment to a quote.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       Adds a comment to the specified quote.
     *       JWT token authentication is mandatory to display username of commenter. Therefore username must be in JWT token. 
     *     parameters:
     *       - in: path
     *         name: quoteId
     *         required: true
     *         description: ID of the quote to comment on.
     *         schema:
     *           type: string
     *           example: 60b8d295f3a1b2c45f87c4c6
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               comment:
     *                 type: string
     *                 example: "Excellent quote!"
     *     responses:
     *       200:
     *         description: Comment successfully added.
     *       400:
     *         description: User ID, username, or comment is missing.
     *       401:
     *         description: Unauthorized - No JWT token was provided.
     *       500:
     *         description: Server error.
     */
    app.post('/api/quotes/addComment/:quoteId', jwtCheck, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const sub = req.auth!.sub;
        const username = req.auth![`${customClaimsNamespace}username`];
        const { quoteId } = req.params;
        const { comment } = req.body;
        
        if (!sub || !username || !comment) {
          res.status(400).json({ message: 'User ID, username, and comment are required' });
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

    /**
     * @swagger
     * /api/quotes/comments/{quoteId}:
     *   get:
     *     summary: Get all quote's comments.
     *     security:
     *       - bearerAuth: []
     *     description: |
     *       Returns all comments for the specified quote. 
     * 
     *       JWT token authentication is optional. If authenticated, the user's comments are marked with isOwner: true. Otherwise isOwner is false.
     * 
     *       Returns Bad request if quote by given ID is not found. Returns empty list if quote is found and has no comments.
     *       
     *     parameters:
     *       - in: path
     *         name: quoteId
     *         required: true
     *         description: ID of the quote to get comments for.
     *         schema:
     *           type: string
     *           example: 60b8d295f3a1b2c45f87c4c6
     *     responses:
     *       200:
     *         description: Returns a list of quote's comments.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   text:
     *                     type: string
     *                   username:
     *                     type: string
     *                   isOwner:
     *                     type: boolean
     *                   createdAt:
     *                     type: string
     *                     format: date-time
     *             examples:
     *               eg1:
     *                 value:
     *                   - text: "Excellent quote!"
     *                     username: "AI"
     *                     isOwner: false
     *                     createdAt: "2025-06-07T10:00:00.000Z"
     *                   - text: "Amazing!"
     *                     username: "Uncle bob"
     *                     isOwner: true
     *                     createdAt: "2026-03-02T12:02:00.000Z"
     *       404:
     *         description: Quote not found.
     *       500:
     *         description: Server error.
     */
    app.get('/api/quotes/comments/:quoteId', optionalJwtCheck, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        const sub = req.auth?.sub;
        const { quoteId } = req.params;
        
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
                isOwner: sub !== null && comment.sub === sub,
                createdAt: comment.createdAt
            };
        });
        
        res.json(comments);
    } catch (error) {
        res.status(500).send();
    }
    });

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

}