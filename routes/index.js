var express = require('express');
var router = express.Router();

var env = require('dotenv').config();
const Client = require('pg').Client;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
client.connect(); //connect to database

var passport = require('passport');
var bcrypt = require('bcryptjs');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('login', {error: req.flash('error')});
});

router.get('/helpStudent', loggedIn, function(req, res, next) {
  res.render('nonAdminHelp');
});

router.get('/helpAdminGrade', loggedIn, function(req, res, next) {
  res.render('gradeAssignmentHelp');
});

router.get('/helpAdminAdd', loggedIn, function(req, res, next) {
  res.render('addUserHelp');
});

router.get('/helpAdminRemove', loggedIn, function(req, res, next) {
  res.render('removeUserHelp');
});

router.get('/back',
  // depends on the fiels "isAdmin", redirect to the different path: admin or notAdmin
  passport.authenticate('local', { failureRedirect: '/', failureFlash:true }),
  function(req, res,next) {

    if (req.user.isadmin == 'admin'){
      res.redirect('/admin');
    }
    else {
      res.redirect('/notAdmin');
    }
});


router.post('/',
  // depends on the fiels "isAdmin", redirect to the different path: admin or notAdmin
  passport.authenticate('local', { failureRedirect: '/', failureFlash:true }),
  function(req, res,next) {

    if (req.user.isadmin == 'admin'){
      res.redirect('/admin');
    }
    else {
      res.redirect('/notAdmin');
    }
});

router.get('/chat', loggedIn,function(req, res,next) {
  // Pass Server-side PORT number to Client-side
  if(req.user.isadmin == 'admin'){
    res.render('chat', {name: req.user.username, admin:'true', text: '[Admin]' ,port: process.env.PORT || 3000 });
  }else{
    res.render('chat', {name: req.user.username, student:'true',text: '', port: process.env.PORT || 3000 });
  }
  
});


router.get('/logout', function(req, res){
    req.logout(); //passport provide it
    res.redirect('/'); // Successful. redirect to localhost:3000/exam
});

router.get('/changePassword', loggedIn, function(req, res){
    res.render('changePassword',{user: req.user});
});

function encryptPWD(password){
    var salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}

router.post('/changePassword', function(req, res,next){
  if (req.body.new1 !== req.body.new2) {
    matchFailure = true;
    res.render('changePassword', {matchFailure: matchFailure, user: req.user})
    next();
  } else {
   client.query('SELECT * FROM users WHERE username=$1', [req.user.username], function(err, result) {
      if (err) {
        console.log("exam.js: sql error ");
        next(err); // throw error to error.hbs.
      } else if (result.rows.length > 0) {
        console.log("Here I am");
        console.log(result.rows[0].password);

        var matched = bcrypt.compareSync(req.body.current, result.rows[0].password);
        if (!matched) {
          res.render('changePassword', {currentFailure: true, user: req.user} );
          console.log("Not matching")
        } else {
          var pwd = encryptPWD(req.body.new1);
          client.query('UPDATE users SET password=\'' + pwd + '\' WHERE username=\'' + req.user.username + '\'');
          console.log('UPDATE users SET password=\'' + pwd + '\' WHERE username=\'' + req.user.username + '\'');
          res.render('changePassword', {success: true, user: req.user} );
        }
      }
   });
  }
});

router.post('/viewAndGradeAssignment', function(req, res,next){
  // add error checking later

   client.query('SELECT * FROM assignment WHERE id=$1', [req.body.id], function(err, result) {
      var success;
      var incorrectID;
      if (err) {
        console.log("exam.js: sql error ");
        next(err); // throw error to error.hbs.
      } else if (result.rows.length > 0) {
        success=true;
        client.query('UPDATE assignment SET grade=\'' + req.body.grade + '\' WHERE id=\'' + req.body.id + '\'');
        if (req.body.comments !== "") {
          //client.query('UPDATE assignment SET comments=\'' + req.body.comments + '\' WHERE id=\'' + req.body.id + '\'');
          client.query('UPDATE assignment SET commented=($1), comments=($2) WHERE id=($3)', [true, req.body.comments, req.body.id]);
          //client.query('UPDATE assignment SET commented=\'' + true + '\' WHERE id=\'' + req.body.id + '\'');
        }
      } else {
        incorrectID = true;
      }

      client.query('SELECT * FROM assignment', function(err,result){
        if (err) {
          console.log("exam.js: sql error ");
          next(err); // throw error to error.hbs.
        }
        else if (result.rows.length > 0) {
          console.log("Here I am");
          res.render('viewAndGradeAssignment', {rows: result.rows, incorrectID: incorrectID,  success: success, user: req.user, } );
        }
        else{
          console.log("This student does not have any assignment");
          res.render('viewAndGradeAssignment', {rows: result.rows, incorrectID: incorrectID,  success: success, user: req.user, } );
        }
      });   
   });
});

router.get('/assignments',loggedIn,function(req, res, next){

  client.query('SELECT * FROM assignment', function(err,result){
    if (err) {
      console.log("index.js: sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      // new stuff
      client.query('SELECT * FROM assignment WHERE submitted = $1', [true], function(err,result2){
        if (err) {
          console.log("index.js: sql error ");
          next(err); // throw error to error.hbs.
        }
        else if (result2.rows.length > 0) {
          client.query('SELECT * FROM assignment WHERE grade != $1', ['-'], function(err,result3){
            if (err) {
              console.log("index.js: sql error ");
              next(err); // throw error to error.hbs.
            }
            else if (result3.rows.length > 0) {
              var finished = ((result2.rows.length/result.rows.length)*100).toFixed(2);
              var graded = ((result3.rows.length/result2.rows.length)*100).toFixed(2);
          
              res.render('viewAndGradeAssignment', {rows: result.rows, user: req.user, finished: finished, graded: graded} );
            }
          });
        }
      });
    }
    else{
      console.log("This student does not have any assignment");
      res.render('viewAndGradeAssignment', {rows: result.rows, user: req.user, finished: 0, graded: 0} );
    }
  });
});

function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect('/');
  }
}

router.get('/notAdmin',loggedIn,function(req, res, next){

  client.query('SELECT * FROM assignment WHERE username = $1',[req.user.username], function(err,result){
    if (err) {
      console.log("index.js: sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      // new stuff start
      console.log("Num entries: " + result.rows.length);
      client.query('SELECT * FROM assignment WHERE username = $1 and submitted = $2',[req.user.username, true], function(err,result2){
        if (err) {
          console.log("index.js: sql error ");
          next(err); // throw error to error.hbs.
        }
        else if (result2.rows.length > 0) {
          console.log("Num submitted: " + result2.rows.length);
          // new stuff
          
          client.query('SELECT * FROM assignment WHERE username = $1 and grade != $2', [req.user.username,'-'], function(err,result3){
            console.log("Num graded: " + result3.rows.length);
            if (err) {
              console.log("index.js: sql error ");
              next(err); // throw error to error.hbs.
            } else if (result3.rows.length > 0) {
              var numGrade = result3.rows.length;
              var total = 0;
              console.log("before" + total);

              for ( i = 0 ; i < numGrade; i++) {
                total = total + +result3.rows[i].grade;
              }
              var average = (total/(numGrade * 100)*100).toFixed(2);

              var gradeFraction = total + "/" + (numGrade*100);

              var numSubmitted = result2.rows.length;

              var teacherFinished = ((numGrade/numSubmitted)*100).toFixed(2);

              var teacherFinishedFraction = numGrade + "/" + numSubmitted;

              var done = (result2.rows.length/result.rows.length * 100).toFixed(2);
              res.render('notAdmin', {rows: result.rows, user: req.user, done: done,
                 grade: average, fraction:gradeFraction, graded: teacherFinished, gradedFraction: teacherFinishedFraction} );
            }
          }); 
       
        }
        else{
          res.render('notAdmin', {rows: result.rows, user: req.user, done: 100} );
        }
      });

    }
    else{
      console.log("This student does not have any assignment");
      res.render('notAdmin', {rows: result.rows, user: req.user} );
    }
  });
});

router.get('/admin',loggedIn,function(req, res, next){
  var finished;
  var graded;
  client.query('SELECT * FROM assignment', function(err,result){
    if (err) {
      console.log("index.js: sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      client.query('SELECT * FROM assignment WHERE submitted = $1', [true], function(err,result2){
        if (err) {
          console.log("index.js: sql error ");
          next(err); // throw error to error.hbs.
        }
        else if (result2.rows.length > 0) {
          client.query('SELECT * FROM assignment WHERE grade != $1', ['-'], function(err,result3){
            if (err) {
              console.log("index.js: sql error ");
              next(err); // throw error to error.hbs.
            }
            else if (result3.rows.length > 0) {
              finished = ((result2.rows.length/result.rows.length)*100).toFixed(2);
              graded = ((result3.rows.length/result2.rows.length)*100).toFixed(2);
              client.query('SELECT * FROM users', function(err,result4){
                if (err) {
                  console.log("index.js: sql error ");
                  next(err); // throw error to error.hbs.
                }
                else if (result4.rows.length > 0) {
                  console.log("Here I am");
                  res.render('admin', {rows: result4.rows, user: req.user, finished: finished, graded: graded} );
                }
                else{
                  console.log("No users");
                  res.render('admin', { user: req.user, finished: finished, graded: graded} );
                }
              });
            }
          });
        }
      });
    } else{
      client.query('SELECT * FROM users', function(err,result4){
        if (err) {
          console.log("index.js: sql error ");
          next(err); // throw error to error.hbs.
        }
        else if (result4.rows.length > 0) {
          console.log("Here I am");
          res.render('admin', {rows: result4.rows, user: req.user, finished: 0, graded: 0} );
        }
        else{
          console.log("No users");
          res.render('admin', { user: req.user, finished: 0, graded: 0} );
        }
      });
    }
  });

  console.log(finished);
  console.log(graded);
  
  /*
  client.query('SELECT * FROM users', function(err,result){
    if (err) {
      console.log("index.js: sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      console.log("Here I am");
      res.render('admin', {rows: result.rows, user: req.user, finished: finished, graded: graded} );
    }
    else{
      console.log("No users");
      res.render('admin', { user: req.user, finished: finished, graded: graded} );
    }
  });*/
});
router.get('/hourSchedule',loggedIn,function(req,res,next){
  client.query('SELECT * FROM chat', function(err,result){
    if(err){
      next(err);
    }
    else{
      res.render('hourSchedule',{rows: result.rows,error: req.flash('error')});
    }
  })
  
});
router.get('/officeHour',loggedIn,function(req,res,next){
  client.query('SELECT * FROM chat', function(err,result){
    if(err){
      next(err);
    }
    else{
      res.render('officeHour',{rows: result.rows,user:req.user, error: req.flash('error')});
    }
  })
  
});
router.post('/officeHour',loggedIn,function(req,res,next){
  if(req.body.startT != '' && req.body.endT != ''){
    client.query('SELECT * FROM chat WHERE admin = $1', [req.user.username], function(err, result) {
      if (err) {
        console.log("unable to query SELECT");
        next(err);
      }
      if (result.rows.length == 0 ) {
          console.log("user not exist");
          client.query('INSERT INTO chat (admin, starttime, endtime) VALUES($1, $2, $3)', [req.user.username, req.body.startT,req.body.endT], function(err, resu) {
            if (err) {
              console.log("unable to query INSERT");
              next(err);
            }
            console.log("update chat");
            
          });
      } else {
        console.log("update chat");
        client.query('UPDATE chat SET starttime=\'' + req.body.startT + '\' ,endtime=\''+ req.body.endT+'\' WHERE admin=\'' + req.user.username + '\'');
      }
      res.redirect('officeHour');
    });
  } 
  
  else{
    client.query('SELECT * FROM chat', function(err,result){
      if(err){
        next(err);
      }
      else{
        res.render('officeHour',{rows: result.rows,user:req.user, empty: "true", error: req.flash('error')});
      }
    })
  }
});
router.get('/addAssignment',function(req, res, next) {
  res.render('addAssignment', {user: req.user, error: req.flash('error')});
});

router.post('/addAssignment',function(req, res, next) {
  client.query('SELECT * FROM users WHERE username = $1', [req.body.username], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      next(err);
    }
    if (result.rows.length > 0) {
        console.log("user exist" + result.rows.length);
        client.query('INSERT INTO assignment (username, description, due, grade, submitted, submission, commented, comments) VALUES($1, $2, $3, $4, $5, $6, $7, $8)', [req.body.username, req.body.description,req.body.due, '-', false, 'None', false, 'None'], function(err, result) {
          if (err) {
            console.log("unable to query INSERT");
            next(err);
          }
          console.log("Assignment creation is successful");
          res.render('addAssignment', {user: req.user , success: "true" });
        });
    } else {
      console.log("user exist" + result.rows.length);
      res.render('addAssignment', {user: req.user , failure: "true" });
    }
  });
});

router.get('/signup',function(req, res) {
    res.render('signup', { user: req.user }); // signup.hbs
});

function validUsername(username) {
  var login = username.trim(); // remove spaces
  return login !== '' && login.search(/ /) < 0;
}

function createUser(req, res, next){
  var salt = bcrypt.genSaltSync(10);
  var pwd = bcrypt.hashSync(req.body.password, salt);
  client.query('INSERT INTO users (username, password, isAdmin) VALUES($1, $2, $3)', [req.body.username, pwd, req.body.usertype], function(err, result) {
    if (err) {
      console.log("unable to query INSERT");
      return next(err); // throw error to error.hbs.
    }
    console.log("User creation is successful");
    res.render('signup', {user: req.user, success: 'true'});
  });
}

function deleteUser(req, res, next){
  
  client.query('DELETE from users WHERE username=$1 AND isAdmin=$2', [req.body.username, 'student'], function(err, result) {
    if (err) {
      console.log("unable to query INSERT");
      return next(err); // throw error to error.hbs.
    }
    console.log("User deletion is successful");
    res.render('removeUser', {user: req.user, success: 'true'});
  });
}

router.post('/signup', loggedIn, function(req, res, next) {
  console.log(req.body.usertype);

  client.query('SELECT * FROM users WHERE username=$1',[req.body.username], function(err,result){
    if (err) {
      console.log("sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      console.log("user exists");
      res.render('signup', { exist: 'true', user: req.user });
    } else {
      console.log("no user with that name");
      createUser(req, res, next);
    }
  });
});

router.get('/removeUser', loggedIn, function(req, res) {
  res.render('removeUser', { user: req.user }); 
});

router.post('/removeUser', function(req, res, next) {
  console.log(req.body.usertype);

  client.query('SELECT * FROM users WHERE username=$1 AND isAdmin=$2',[req.body.username, 'student'], function(err,result){
    if (err) {
      console.log("sql error ");
      next(err); // throw error to error.hbs.
    }
    else if (result.rows.length > 0) {
      console.log("user exists");
      deleteUser(req,res,next);
      res.render('removeUser', { success: 'true', user: req.user });
    } else {
      console.log("no user with that name");
      res.render('removeUser', { nonexist: 'true', user: req.user });
    }
  });
});



router.post('/submit', function(req, res, next) {
  client.query('SELECT * FROM assignment WHERE id = $1', [req.body.id], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      next(err);
    } else if (result.rows.length > 0) {
        console.log('submit', {user: req.user, rows: result.rows[0], id: req.body.id });
        res.render('submit', {user: req.user, rows: result.rows[0], id: req.body.id });
    } 
  });
});

router.post('/viewAndGradeSubmission', function(req, res, next) {
  client.query('SELECT * FROM assignment WHERE id = $1', [req.body.id], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      next(err);
    } else if (result.rows.length > 0) {
        res.render('viewSubmission', {user: req.user, rows: result.rows, id: req.body.id});
    } 
  });
});

router.post('/addSubmission', function(req, res, next) {
  //client.query('UPDATE assignment SET submitted=\'true\', submission=\'' + req.body.submission + '\' WHERE id=\'' + req.body.id + '\'');
  console.log('UPDATE assignment SET submitted=\'true\', submission=\'' + req.body.submission + '\' WHERE id=\'' + req.body.id + '\'')
  client.query('UPDATE assignment SET submitted=($1), submission=($2) WHERE id=($3)', [true, req.body.submission, req.body.id]);
  res.render('submit', {success:true});
});


module.exports = router;

