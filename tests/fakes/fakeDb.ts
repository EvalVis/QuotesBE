import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongoServer: MongoMemoryServer;
let client: MongoClient;

export async function start() {
  mongoServer = await MongoMemoryServer.create();
  client = new MongoClient(mongoServer.getUri());

  await client.connect();
  const db = client.db();

  return db;
}

export async function stop() {
  await client.close();
  await mongoServer.stop();
} 