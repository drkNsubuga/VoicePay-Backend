const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// AWS Configuration
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const transcribeService = new AWS.TranscribeService();
const lexRuntime = new AWS.LexRuntime();
const polly = new AWS.Polly();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Mock User Data
const USERS_TABLE = 'VoicePayUsers';

// API Endpoints

// 1. Process Voice Command
app.post('/api/voice-command', async (req, res) => {
  const { audioUrl } = req.body;
  
  const params = {
    TranscriptionJobName: `Transcription-${Date.now()}`,
    LanguageCode: 'en-US',
    Media: { MediaFileUri: audioUrl },
    MediaFormat: 'mp3',
    OutputBucketName: process.env.AWS_S3_BUCKET,
  };

  try {
    await transcribeService.startTranscriptionJob(params).promise();
    res.status(200).send({ message: 'Transcription started' });
  } catch (err) {
    console.error('Error starting transcription:', err);
    res.status(500).send({ error: 'Failed to start transcription' });
  }
});

// 2. Get Intent from Command
app.post('/api/get-intent', async (req, res) => {
  const { textCommand } = req.body;

  const params = {
    botName: 'VoicePayBot',
    botAlias: 'VoicePayAlias',
    userId: `User-${Date.now()}`,
    inputText: textCommand,
  };

  try {
    const response = await lexRuntime.postText(params).promise();
    res.status(200).send({ intent: response.intentName, slots: response.slots });
  } catch (err) {
    console.error('Error processing intent:', err);
    res.status(500).send({ error: 'Failed to process intent' });
  }
});

// 3. Send Money
app.post('/api/send-money', async (req, res) => {
  const { userId, recipient, amount } = req.body;

  // Simulate transaction and store it
  const transaction = {
    userId,
    recipient,
    amount,
    date: new Date().toISOString(),
  };

  const params = {
    TableName: USERS_TABLE,
    Item: transaction,
  };

  try {
    await dynamoDB.put(params).promise();
    res.status(200).send({ message: 'Transaction successful', transaction });
  } catch (err) {
    console.error('Error saving transaction:', err);
    res.status(500).send({ error: 'Failed to save transaction' });
  }
});

// 4. Check Balance
app.get('/api/check-balance/:userId', async (req, res) => {
  const { userId } = req.params;

  const params = {
    TableName: USERS_TABLE,
    Key: { userId },
  };

  try {
    const result = await dynamoDB.get(params).promise();
    res.status(200).send({ balance: result.Item ? result.Item.balance : 0 });
  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).send({ error: 'Failed to fetch balance' });
  }
});

// 5. Text-to-Speech Feedback
app.post('/api/feedback', async (req, res) => {
  const { text } = req.body;

  const params = {
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: 'Joanna', // Choose a voice compatible with your region/language
  };

  try {
    const response = await polly.synthesizeSpeech(params).promise();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(response.AudioStream);
  } catch (err) {
    console.error('Error generating speech:', err);
    res.status(500).send({ error: 'Failed to generate speech' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`VoicePay backend running on http://localhost:${port}`);
});
