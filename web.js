var async   = require('async');
var express = require('express');
var util    = require('util');
var helper    = require('./helper.js');
var posts    = require('./jm-firebase.js').posts();

var appId = '290427237712179';
var secret = '372ddf9dbff0853030a779f9db26c072';

// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),

  require('./lib/faceplate').middleware(helper.faceplateOptions)
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
  helper.facebook(function (facebook) {
    facebook.get('/me/', { }, function(data) {
      res.send(require('util').inspect(data));
    });
  });
}

//Process user posts and take actions as necessary
function processUserPost(postId, text){
  console.log('[processing post] '+postId+': ' + text)
  
  if (helper.match(text, ['hello', 'hi'])) {
    helper.fbPostComment(postId, 'Sup. I am alive.');
  }
  // querying
  else if (helper.match(text, ['how', 'what'])) {
    if (helper.match(text, ['usage', 'energy'])) {
      helper.fbPostComment(postId, 'You are currently using 256 kWh.');
    } else if (helper.match(text, ['light'])) {
      helper.fbPostComment(postId, '4 out of 7 lights are currently turned on.');
    } else if (helper.match(text, ['therm', 'temp', 'hot', 'cold'])) {
      helper.fbPostComment(postId, 'Thermostat is currently set to 68 degrees.');
    }
  }
  // turn off things
  else if (helper.match(text, ['close', 'off', 'shut', 'down'])) {
    if (helper.match(text, ['refrigerator', 'fridge'])) {
      helper.fbPostComment(postId, 'Shutting off the refrigerator.');
    } else if (helper.match(text, ['light'])) {
      helper.fbPostComment(postId, 'Turning off the light.');
    } else if (helper.match(text, ['therm', 'temp'])) {
      var newTemp = text.match(/\d+/);
      var to = '';
      if (newTemp) {
        to = ' to '+newTemp[0]+' degrees';
      }
      helper.fbPostComment(postId, 'Raising thermostat temperature'+to+'.');
    }
  }
  // turn on things
  else if (helper.match(text, ['open', 'on', 'start', 'up'])) {
    if (helper.match(text, ['refrigerator', 'fridge'])) {
      helper.fbPostComment(postId, 'Starting the refrigerator.');
    } else if (helper.match(text, ['light'])) {
      helper.fbPostComment(postId, 'Turning on the light.');
    } else if (helper.match(text, ['therm', 'temp'])) {
      var newTemp = text.match(/\d+/);
      var to = '';
      if (newTemp) {
        to = ' to '+newTemp[0]+' degrees';
      }
      helper.fbPostComment(postId, 'Lowering thermostat temperature'+to+'.');
    }
  }
}

//Process data coming back from Tendril API
function processTendrilMetering(data){
	
}

var started = false;
var timeout = 5 * 1000;
var counter = 0;
function main_loop() {
  console.log(++counter);
  
  // pull data from tendril
  // decision tree
  // post to fb wall
  
  setTimeout(main_loop, timeout);
}

function start_loop(req, res){
  if (started) {
    res.send('Error: Main loop already started.');
    return;
  }
  
  helper.facebook(function (facebook) {
    facebook.post(
      '/'+appId+'/subscriptions'
      ,{
        object        : 'user',
        fields        : 'feed',
        callback_url  : req.headers['host']+'/webhooks/facebook',
        verify_token  : 'test',
        access_token  : '290427237712179|oNvo-XthhLpgvEG0XAGYhZvrhbM'
      }
      ,function (data) {
        console.log(data);
      });
  });
  
  setTimeout(main_loop, 0);
  started = true;
  res.send('Success: Main loop started.');
}

function handle_subscription_verification(req, res) {
  console.log('handle_subscription_verification');
  if (req.query['hub.verify_token'] == 'test') {
    res.send(req.query['hub.challenge']);
  } else {
    res.send();
  }
}

function handle_subscription_update(req, res) {
  console.log('handle_subscription_update');
  if (req.body && req.body.entry && req.body.entry.length) {
    // get the latest
    var entry = req.body.entry[0];
    console.log("[facebook hook]", entry);
    posts.getLatestTime(function (lastLatestTime) {
      posts.setLatestTime(entry.time);
      helper.facebook(function (facebook) {
        facebook.get('/me/feed', {since: lastLatestTime, limit: 4}, function(data) {
          for (var i = 0; i < data.length; i++) {
            var post = data[i];
            posts.isPostOld(post, function (post, exists) {
              if (!exists) {
                posts.setPostOld(post);
                processUserPost(post.id, post.message);
              }
            });
          };
        });
      });
    });
  }
  res.send();
}

function testfeed(req, res) {
  req.facebook.get('/me/feed', {
    since: '1335714106',
  } ,function(data) {
    console.log(data);
    res.send(data);
  });
}

app.get('/', handle_facebook_request);
app.get('/test', do_stuff);


app.get('/start', start_loop);
app.get('/testpost', function(req, res){
  helper.fbPostMessage('test test test');
  res.send('sent');
});
app.get('/testpostback', function(req, res){
  processUserPost(req.query.input);
  res.send('Got it!');
});

app.post('/', handle_facebook_request);
app.get('/webhooks/facebook', handle_subscription_verification);
app.post('/webhooks/facebook', handle_subscription_update);
app.get('/testfeed', testfeed);
