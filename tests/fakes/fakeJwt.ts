import express from 'express';
import { jest } from '@jest/globals';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        [key: string]: any;
        sub: string;
      };
    }
  }
}

export const optionalJwtCheck = jest.fn((req: express.Request, _: express.Response, next: express.NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return next();
  }
  const token = auth.split(' ')[1];
  req.auth = { sub: token.split(";")[0], [`${process.env.jwt_customClaimsNamespace}username`]: token.split(";")[1] };
  next();
});

export const jwtCheck = jest.fn((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  const token = auth.split(' ')[1];
  req.auth = { sub: token.split(";")[0], [`${process.env.jwt_customClaimsNamespace}username`]: token.split(";")[1] };
  next();
});