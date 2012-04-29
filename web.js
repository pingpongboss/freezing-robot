var async   = require('async');
var express = require('express');
var util    = require('util');
var helper    = require('./helper.js');

var appId = process.env.FACEBOOK_APP_ID || '301282389949117';
var secret = process.env.FACEBOOK_SECRET || 'edcc1c9ede78eb15bc773fed78602619';
// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
  require('./lib/faceplate').middleware({
    app_id: appId,
    secret: secret,
    scope:  'user_likes,user_photos,user_photo_video_tags,read_stream,publish_stream'
  })
);

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.dynamicHelpers({
  'host': function(req, res) {
    return req.headers['host'];
  },
  'scheme': function(req, res) {
    req.headers['x-forwarded-proto'] || 'http'
  },
  'url': function(req, res) {
    return function(path) {
      return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(path);
    }
  },
  'url_no_scheme': function(req, res) {
    return function(path) {
      return '://' + app.dynamicViewHelpers.host(req, res) + path;
    }
  },
}); 

function render_page(req, res) {
  req.facebook.app(function(app) {
    req.facebook.me(function(user) {
      res.render('index.ejs', {
        layout:    false,
        req:       req,
        app:       app,
        user:      user
      });
    });
  });
}

function handle_facebook_request(req, res) {

  // if the user is logged in
  if (req.facebook.token) {

    async.parallel([
      function(cb) {
        // query 4 friends and send them to the socket for this socket id
        req.facebook.get('/me/friends', { limit: 4 }, function(friends) {
          req.friends = friends;
          cb();
        });
      },
      function(cb) {
        // query 16 photos and send them to the socket for this socket id
        req.facebook.get('/me/photos', { limit: 16 }, function(photos) {
          req.photos = photos;
          cb();
        });
      },
      function(cb) {
        // query 4 likes and send them to the socket for this socket id
        req.facebook.get('/me/likes', { limit: 4 }, function(likes) {
          req.likes = likes;
          cb();
        });
      },
      function(cb) {
        // use fql to get a list of my friends that are using this app
        req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function(result) {
          req.friends_using_app = result;
          cb();
        });
      }
    ], function() {
      render_page(req, res);
    });

  } else {
    render_page(req, res);
  }
}

function do_stuff(req, res){
  req.facebook.get('/me/', { }, function(data) {
    res.send(require('util').inspect(data));
  });
}

var started = false;
var timeout = 5 * 1000;
var counter = 0;
function main_loop(req) {
  console.log(++counter);
  
  // pull data from tendril
  // decision tree
  // post to fb wall
  
  setTimeout(function() {main_loop(req)}, timeout);
}

function start_loop(req, res){
  if (started) {
    res.send('Error: Main loop already started.');
    return;
  }
    
  req.facebook.post(
    '/'+appId+'/subscriptions'
    ,{
      object        : 'user',
      fields        : 'feed',
      callback_url  : req.headers['host']+'/update',
      verify_token  : 'test',
      access_token  : '301282389949117|1HW0Hd79t50X9wx05jbgkf-TO5g'
    }
    ,function (data) {
      console.log(data);
    });
  
  setTimeout(function() {main_loop(req)}, 0);
  started = true;
  res.send('Success: Main loop started.');
}

function handle_subscription_verification(req, res) {
  console.log('handle_subscription_verification');
  res.send();
}

function handle_subscription_update(req, res) {
  console.log('handle_subscription_update');
  res.send();
}


app.get('/', handle_facebook_request);
app.get('/test', do_stuff);
app.get('/start', start_loop);
app.get('/testpost', function(req, res){
  helper.fbPostMessage('test test', req);
  res.send('sent');
});
app.post('/', handle_facebook_request);
app.get('/update', handle_subscription_verification);
app.post('/update', handle_subscription_update);
