var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
// new stuff

var app = express();

// new stuff
var session = require('express-session');
var flash = require('express-flash');
var env = require('dotenv').config();

const Client = require('pg').Client;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
client.connect(); //connect to database

// javascript password encryption (https://www.npmjs.com/package/bcryptjs)
var bcrypt = require('bcryptjs');
//  authentication middleware
var passport = require('passport');
// authentication locally (not using passport-google, passport-twitter, passport-github...)
var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy({
  usernameField: 'username', // form field
  passwordField: 'password'
},
function(username, password, done) {
  client.query('SELECT * FROM users WHERE username = $1', [username], function(err, result) {
    if (err) {
      console.log("app.js: SQL error");
      return done(null,false, {message: 'OOPS! sql error'});
    }
    if (result.rows.length > 0) {
      var matched = bcrypt.compareSync(password, result.rows[0].password);
      if (matched) {
        console.log("Successful login, ", result.rows[0]);
        return done(null, result.rows[0]);
      }
    }
    console.log("Bad username or password");
    // returning to passport
    // message is passport key
    return done(null, false, {message: 'Bad username or password'});
  });
})
);

// Store user information into session
passport.serializeUser(function(user, done) {
  //return done(null, user.id);
  return done(null, user);
});

// Get user information out of session
passport.deserializeUser(function(id, done) {
  return done(null, id);
});

// Use the session middleware
// configure session object to handle cookie
// req.flash() requires sessions
app.use(session({
  secret: 'COMP335',
  resave:false,
  saveUninitialized: true,
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
// new stuff ends here (we have one more line below)


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
// new stuff

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;