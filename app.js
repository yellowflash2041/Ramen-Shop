require('dotenv').config();

const chalk = require('chalk');

const port = process.env.PORT || '8080';

console.log(chalk.bgYellow.black('Loading packages...'));
var createError = require('http-errors');
var express = require('express');
var path = require('path');
const favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require('mongoose');

console.log(chalk.bgBlue.white('Initializing Express...'));
var app = express();
if (process.env.APP_ENV === 'development') {
  console.log(chalk.bgBlue.white('App environment is DEVELOPMENT'));
  app.set('env', 'development');
}
const server = require('http').createServer(app);
const io = require('socket.io')(server);
console.log(`Assigning ${chalk.cyan('io')} to ${chalk.cyan('global.io')}...`);
global.io = io;
console.log(chalk.bgYellow.black('Loading routes...'));

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log(chalk.bgYellow.black('Connecting to MongoDB...'));
mongoose.connect(process.env.MONGO_URI);
global.db = mongoose.connection;

global.db.on('error', error => {
  console.error('Mongoose connection error: ');
  console.dir(error);
});

global.db.once('open', () => {
  console.log(chalk.bgGreen.black('Connected to MongoDB.'));

  server.listen(port, function() {
    process.stdout.write('\x07'); // BEEP
    console.log(chalk.bgGreen.black(`Listening on port ${port}.`));
  });
});

module.exports = app;
