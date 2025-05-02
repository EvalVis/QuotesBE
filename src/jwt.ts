import express from 'express';
import jwksRsa from 'jwks-rsa';
import { expressjwt as jwt } from 'express-jwt';
import type { Algorithm } from 'jsonwebtoken';

export const optionalJwtCheck = (req : express.Request, res : express.Response, next : express.NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth) {
        return next();
    }
    jwtCheck(req, res, next);
}

export const jwtCheck = jwt({
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