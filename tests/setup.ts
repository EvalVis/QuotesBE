import { Db } from 'mongodb';
import express from 'express';
import { start as startDb, stop as stopDb } from './fakes/fakeDb';
import { createApi } from '../src/api';
import { jest } from '@jest/globals';
import { optionalJwtCheck, jwtCheck } from './fakes/fakeJwt';

jest.mock('../src/jwt');

jest.mocked(require('../src/jwt')).optionalJwtCheck = optionalJwtCheck;
jest.mocked(require('../src/jwt')).jwtCheck = jwtCheck;

process.env.quotes_randomFetchSize = '3';
process.env.db_name = 'Quotes';
process.env.db_quotesCollectionName = 'Quotes';
process.env.db_usersCollectionName = 'Users'; 
process.env.jwt_customClaimsNamespace = 'https://quotes.programmersdiary.com/';

export interface TestContext {
  db: Db;
  app: express.Application;
  server: any;
}

export async function start(): Promise<TestContext> {
  const db = await startDb();
  const app = express();
  app.use(express.json());
  createApi({ mongoDb: db, app });
  const server = app.listen(0);

  return { db, app, server };
}

export async function stop(context: TestContext): Promise<void> {
  context.server.close();
  await stopDb();
}