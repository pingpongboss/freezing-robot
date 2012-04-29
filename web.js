var async   = require('async');
var express = require('express');
var util    = require('util');
var helper    = require('./helper.js');

var rest = require('restler');



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
function processUserPost(text){
  console.log("[processing post] " + text)
  switch (text)
  {
    case 'How is my usage?': 
      helper.fbPostMessage('Using 256 kWh');
      break;
    case 'hello': 
      helper.fbPostMessage('I am here');
      break;

    default:  
       //nothing
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
        callback_url  : req.headers['host']+'/update',
        verify_token  : 'test',
        access_token  : '301282389949117|1HW0Hd79t50X9wx05jbgkf-TO5g'
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
  if (req.body && req.body.entry) {
    for (var i = 0; i < req.body.entry.length; i++) {
      var entry = req.body.entry[i];
      console.log("[facebook hook]" + entry);
    };
  }
  res.send();
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

function generate_uid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	return v.toString(16);
    });
}

var app_key = 'b258166257d8d16c0ff8005bf6e61aeb';
var app_secret = '12ac4b5f60df625040f3b6e525604bb5';
var connect_url = 'https://dev.tendrilinc.com';
var request_token_url = 'https://dev.tendrilinc.com/oauth/request_token';
var authorize_url = 'https://dev.tendrilinc.com/oauth/authorize';
var access_token_url = 'https://dev.tendrilinc.com/oauth/access_token';
var callback_url = 'http://freezingrobot.herokuapp.com:3000/tendril/callback';
var another_callback_url = 'http://freezingrobot.herokuapp.com:3000/tendril/another_callback';

app.get('/tendril/another_callback', function(req,res){
    var url = connect_url +
	'/connect/user/current-user';

    var headers = {
	'Accept': 'application/json',
	'Content-Type': 'application/json',
	'Access_Token': req.session.access_token
    };

    rest.get(url, {
	headers: headers
    }).on('complete', function(data){
	res.send(data);
    });

});

app.get('/tendril/callback', function(req, res){
    if (!req.query.code){
	res.send('No code!');
    }

    req.session.code = req.query.code;
    req.session.check_state = req.query.state;
   
    var url = access_token_url;

    var headers = {
	'Accept': 'application/json',
	'Content-Type': 'application/json'
    }

    var data = {
	grant_type: 'authorization_code',
	code      : req.session.code,
	redirect_uri : another_callback_url,
	client_id  : app_key,
	client_secret: app_secret
    }
    
    rest.get(url, {
	query: data,
	headers: headers
    }).on('complete', function(data){
	
	req.session.access_token = data.access_token;
	req.session.token_type = data.token_type;
	req.session.expires_in = data.expires_in;
	req.session.refresh_token = data.refresh_token;
	req.session.scope = data.scope;
	
	req.session.loggedin = true;
	
	var date = new Date();
	var expires_time = date + parseInt(data.expires_in);
	
	req.session.expires_time = expires_time;

	res.redirect(another_callback_url, 303);
    });
});

app.get('/tendril/auth', function(req, res){


    var extendedPermissions = 'account billing consumption';
    req.session.authorize_state = generate_uid();
    
    var auth_url = authorize_url + 
	'?response_type=code' +
	'&client_id=' + app_key +
	'&redirect_uri=' + callback_url +
	'&scope='+ extendedPermissions + 
	'&state=' + req.session.authorize_state;
    
    res.redirect(auth_url);

/*
$url = $connectURL;
  $url .= '/oauth/authorize';
  $url .= '?response_type=code';
  $url .= '&client_id=' . $client_id;
  $url .= '&redirect_uri=' . $callbackURL;
  $url .= '&scope=' . $extendedPermissions;
  $_SESSION['authorize_state'] = md5(uniqid(mt_rand(), true));
  $url .= '&state=' . $_SESSION['authorize_state'];
  header("Location: $url", true, 303);*/
	
   
   

});