const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
  secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Quotes';

app.get('/', (_, res) => {
  res.send('test');
});

app.get('/api/quotes/random', async (_, res) => {
  try {
    const query = {
      TableName: TABLE_NAME,
      Limit: 1
    };
    const result = await dynamoDB.scan(query).promise();
    res.json(result.Items[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 