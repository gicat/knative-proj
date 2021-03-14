var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const { Firestore } = require('@google-cloud/firestore');
const { PubSub }= require('@google-cloud/pubsub');

var app = express();
const config = {
    // Knative defaults to port 8080.
    port: 8080,
};
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Deploying to Cloud Run, which already has access to a service account
// (https://cloud.google.com/run/docs/securing/service-identity) so no need
// to create a service account key and provide its path in the constructor
// options for the GCP clients, and no need to specify project ID.
const feedbackRef = new Firestore().collection('Feedback');
const pubsubClient = new PubSub();

app.post('/', function (req, res) {
    const feedback = req.body.feedback;
    console.log('feedback:' + feedback);

    // Validate your input
    // If the input is wrong or missing, stop
    if (!feedback) {
        throw createError(400, 'Malformed input: feedback key not found');
    }
    // Create a new feedback object to save
    const entity = {
        createdAt: new Date().toJSON(),
        feedback: feedback,
        classified: false,
        classifiedAt: null,
        sentimentScore: -1,
        sentimentMagnitude: -1
    };
    const response = addFeedback(entity);
    console.log('Added document with ID: ', response);
    // Send out a Pubsub message that your object was saved
    const dataBuffer = Buffer.from(JSON.stringify(entity));
    pubsubClient.topic('feedback-created').publish(dataBuffer);
    // Respond to the client that the object was saved
    res.status(201).send();
});

async function addFeedback(entity) {
    const response = await feedbackRef.add(entity);
    return response;
}

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

function handleExit(signal) {
    console.log('Received ${signal}. Close my server properly.');
    server.close(function () {
        process.exit(0);
    });
}
process.on('SIGINT', handleExit);
process.on('SIGQUIT', handleExit);
process.on('SIGTERM', handleExit);

module.exports = app;
