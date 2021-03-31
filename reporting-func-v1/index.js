const bodyParser = require('body-parser');
const express = require('express');
const { google } = require('googleapis');
const Firestore = require('@google-cloud/firestore');
const _ = require('lodash');

const config = {
  // Knative defaults to port 8080.
  port: 8080,
};

const sheets = google.sheets('v4');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const feedbackRef = new Firestore().collection('Feedback');

const app = express();

// Allows receiving JSON body requests for adding new feedback
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  try {
    // Messages always come in as base64 - need to decode them.
    const message = JSON.parse(Buffer.from(req.body.message.data, 'base64')
      .toString('utf-8'));
    console.log(`Received message:`, message);

    // Ignore invalid messages (right now, there's nothing else we could do
    // with them).
    if (_.isNil(message.classifiedFeedbackId)) {
      console.log(`Invalid message received. Ignoring.`);
      res.status(200).send();
      return;
    }
	
	// If message is valid, get feedback out of Firestore.
    // (https://firebase.google.com/docs/firestore/query-data/get-data#node.js)
    const classifiedFeedbackId = message.classifiedFeedbackId;
    const doc = await feedbackRef.doc(classifiedFeedbackId).get();

    if (!doc.exists) {
      console.log(`No feedback doc exists with ID ${classifiedFeedbackId}.`);
      res.status(200).send();
      return;
    }

    const feedbackObj = doc.data();
	
	const spreadsheetId = '1oGHglGr7ff-Hr63OtuzFTU-UhZ5a2ZM5nbkzl16rV6Q';
	const auth = await getAuthToken();
	
	sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'sheet1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [
		  ['feedback', feedbackObj.feedback],
		  ['createdAt', feedbackObj.createdAt],
		  ['sentimentScore', feedbackObj.sentimentScore],
		  ['sentimentMagnitude', feedbackObj.sentimentMagnitude],
		  ['version', 'v1'],
		  ['', '']
        ],
      },
      auth: auth
    }, (err, response) => {
      if (err) return console.error(err)
    });

    res.status(200).send();
    return;
  } catch (e) {
    console.log(`Error processing message:`, e);
    // Send 200 (not 500) in case of error because right now we don't have a way to handle
    // loops caused by Pub/Sub re-sending messages forever.
    res.status(200).send();
    return;
  }
});

async function getAuthToken() {
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES
  });
  const authToken = await auth.getClient();
  return authToken;
}

async function getSpreadSheet({spreadsheetId, auth}) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    auth,
  });
  return res;
}

const server = app.listen(config.port, () => {
  console.log(`analysis-func app listening at http://localhost:${config.port}`);
});

// Capture SIGINT and SIGTERM and perform shutdown. Helps make sure the pod
// gets terminated within a reasonable amount of time.
process.on('SIGINT', () => {
  console.log(`Received SIGINT at ${new Date()}.`);
  shutdown();
});
process.on('SIGTERM', () => {
  console.log(`Received SIGTERM at ${new Date()}.`);
  shutdown();
});

function shutdown() {
  console.log('Beginning graceful shutdown of Express app server.');
  server.close(function () {
    console.log('Express app server closed.');
  });
  process.exit(0);
}
