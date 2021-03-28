const bodyParser = require('body-parser');
const express = require('express');
const Firestore = require('@google-cloud/firestore');
const language = require('@google-cloud/language');
const { PubSub } = require('@google-cloud/pubsub');
const _ = require('lodash');

const config = {
  // Knative defaults to port 8080.
  port: 8080,
};

// Deploying to a Knative service using a Kubernetes service account associated
// with a Google SA (using Workload Identity), so no need to create a service
// account key and provide its path in the constructor options for the GCP
// clients, and no need to specify project ID.
const feedbackRef = new Firestore().collection('feedback');
const pubsubClient = new PubSub();
const languageClient = new language.LanguageServiceClient();

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
    if (_.isNil(message.newFeedbackId)) {
      console.log(`Invalid message received. Ignoring.`);
      res.status(200).send();
      return;
    }

    // If message is valid, get feedback out of Firestore.
    // (https://firebase.google.com/docs/firestore/query-data/get-data#node.js)
    const newFeedbackId = message.newFeedbackId;
    const doc = await feedbackRef.doc(newFeedbackId).get();

    if (!doc.exists) {
      console.log(`No feedback doc exists with ID ${newFeedbackId}.`);
      res.status(200).send();
      return;
    }

    const feedbackObj = doc.data();

    // Then, call sentiment analysis API using feedback.
    // (https://cloud.google.com/natural-language/docs/quickstart-client-libraries#client-libraries-install-nodejs)
    const detectResult = await languageClient.analyzeSentiment({
      document: {
        content: feedbackObj.feedback,
        type: 'PLAIN_TEXT',
      },
    });

    const documentSentiment = detectResult[0].documentSentiment;

    // Then, save feedback with sentiment info back to Firestore.
    await feedbackRef.doc(newFeedbackId).set({
      classified: true,
      classifiedAt: new Date().toISOString(),
      sentimentScore: documentSentiment.score,
      sentimentMagnitude: documentSentiment.magnitude,
    }, { merge: true });
    console.log(`Feedback document updated in Firestore with sentiment info.`);

    // Finally, notify via feedback-classified topic that this was all successful.
    const msg = JSON.stringify({
      classifiedFeedbackId: newFeedbackId,
    });
    await pubsubClient.topic('feedback-classified').publish(Buffer.from(msg));
    console.log(`Message published to Pub/Sub (classified feedback ID = ${newFeedbackId}).`);

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
