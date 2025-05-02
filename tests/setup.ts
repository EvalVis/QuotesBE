import { jest } from '@jest/globals';
import { optionalJwtCheck, jwtCheck } from './fakes/fakeJwt';

jest.mock('../src/jwt');

jest.mocked(require('../src/jwt')).optionalJwtCheck = optionalJwtCheck;
jest.mocked(require('../src/jwt')).jwtCheck = jwtCheck;

process.env.quotes_randomFetchSize = '3';
process.env.db_name = 'Quotes';
process.env.db_quotesCollectionName = 'Quotes';
process.env.db_usersCollectionName = 'Users'; 