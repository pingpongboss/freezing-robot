var async = require('async');
var express = require('express');
var util = require('util');
var helper = require('./helper.js');
var posts = require('./jm-firebase.js').posts();
var tendrils = require('./jm-firebase.js').tendrils();
var rest = require('restler');



var appId = '290427237712179';
var secret = '372ddf9dbff0853030a779f9db26c072';

// var Twit = require('twit');
// var T = new Twit({
//     consumer_key:         'NmCRPoeyNoV3xGyck5jeIA'
//     , consumer_secret:      'F3IkEmtrNCGfH5E3858MU7BOforCKxTK5TESOD0Zs'
//     , access_token:         '566262754-OG3H23OMQCauPJAfXjmQS8JVwVOzvvcRwZHX6Hom'
//     , access_token_secret:  '8ZxYxglKfZwJ0oe90UU02qXXLlglEcJNQ7vClZbYQ'
// });
// T.post('statuses/update', { status: 'testing' }, function(err, reply) {
//   console.log('twitterPostMessage: ', err, reply);
// });


// create an express webserver
var app = express.createServer(
    express.logger(), express.static(__dirname + '/public'), express.bodyParser(), express.cookieParser(),
// set this to a secret value to encrypt session cookies
express.session({
    secret: process.env.SESSION_SECRET || 'secret123'
}),

require('./lib/faceplate').middleware(helper.faceplateOptions));

// listen to the PORT given to us in the environment
var port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log("Listening on " + port);
});

app.dynamicHelpers({
    'host': function (req, res) {
        return req.headers['host'];
    },
    'scheme': function (req, res) {
        req.headers['x-forwarded-proto'] || 'http'
    },
    'url': function (req, res) {
        return function (path) {
            return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(path);
        }
    },
    'url_no_scheme': function (req, res) {
        return function (path) {
            return '://' + app.dynamicViewHelpers.host(req, res) + path;
        }
    },
});

function render_page(req, res) {
    req.facebook.app(function (app) {
        req.facebook.me(function (user) {
            res.render('index.ejs', {
                layout: false,
                req: req,
                app: app,
                user: user
            });
        });
    });
}


function handle_facebook_request(req, res) {
    // if the user is logged in
    if (req.facebook.token) {

        async.parallel([

            function (cb) {
            // query 4 friends and send them to the socket for this socket id
            req.facebook.get('/me/friends', {
                limit: 4
            }, function (friends) {
                req.friends = friends;
                cb();
            });
        }, function (cb) {
            // query 16 photos and send them to the socket for this socket id
            req.facebook.get('/me/photos', {
                limit: 16
            }, function (photos) {
                req.photos = photos;
                cb();
            });
        }, function (cb) {
            // query 4 likes and send them to the socket for this socket id
            req.facebook.get('/me/likes', {
                limit: 4
            }, function (likes) {
                req.likes = likes;
                cb();
            });
        }, function (cb) {
            // use fql to get a list of my friends that are using this app
            req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function (result) {
                req.friends_using_app = result;
                cb();
            });
        }], function () {
            render_page(req, res);
        });

    } else {
        render_page(req, res);
    }
}

//Process user posts and take actions as necessary
function processUserPost(post) {
    var postId = post.id;
    var text = post.message;
    var fromId = post.from.id;
    console.log('[processing post] ', postId, text, fromId);
    
    helper.isFamily(fromId, function (isFamily) {
        console.log('isFamily', isFamily);
        if (isFamily) {
            if (helper.contains(text, ['hello', 'hi'])) {
                helper.fbPostComment(postId, 'Sup. I am alive.');
            }
            // querying
            else if (helper.contains(text, ['how', 'what'])) {
                if (helper.contains(text, ['usage', 'energy'])) {
                    helper.fbPostComment(postId, 'You are currently using 256 kWh.');
                } else if (helper.contains(text, ['light'])) {
                    helper.fbPostComment(postId, '4 out of 7 lights are currently turned on.');
                } else if (helper.contains(text, ['therm', 'temp', 'hot', 'cold'])) {
                    helper.fbPostComment(postId, 'Thermostat is currently set to 68 degrees.');
                }
            }
            // turn off things
            else if (helper.contains(text, ['close', 'off', 'shut', 'down', 'lower', 'decrease', 'cool'])) {
                if (helper.contains(text, ['refrigerator', 'fridge'])) {
                    helper.fbPostComment(postId, 'Shutting off the refrigerator.');
                } else if (helper.contains(text, ['light'])) {
                    helper.manageLight(false, function (data) {
                        console.log(data);
                        helper.fbPostComment(postId, 'Turning off the light.');
                    });
                } else if (helper.contains(text, ['therm', 'temp'])) {
                    var newTemp = text.match(/\d+/);
                    var to = '';
                    if (newTemp) {
                        to = ' to ' + newTemp[0] + ' degrees';
                    }
                    helper.fbPostComment(postId, 'Lowering thermostat temperature' + to + '.');
                }
            }
            // turn on things
            else if (helper.contains(text, ['open', 'on', 'start', 'up', 'increase', 'heat'])) {
                if (helper.contains(text, ['refrigerator', 'fridge'])) {
                    helper.fbPostComment(postId, 'Starting the refrigerator.');
                } else if (helper.contains(text, ['light'])) {
                    helper.manageLight(true, function (data) {
                        console.log(data);
                        helper.fbPostComment(postId, 'Turning on the light.');
                    });
                } else if (helper.contains(text, ['therm', 'temp'])) {
                    var newTemp = text.match(/\d+/);
                    var to = '';
                    if (newTemp) {
                        to = ' to ' + newTemp[0] + ' degrees';
                    }
                    helper.fbPostComment(postId, 'Raising thermostat temperature' + to + '.');
                }
            }
        }
    });
}

//Process data coming back from Tendril API
function processTendrilMetering(data) {

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

function start_loop(req, res) {
    if (started) {
        res.send('Error: Main loop already started.');
        return;
    }

    helper.facebook(function (facebook) {
        facebook.post('/' + appId + '/subscriptions', {
            object: 'user',
            fields: 'feed',
            callback_url: req.headers['host'] + '/webhooks/facebook',
            verify_token: 'test',
            access_token: '290427237712179|oNvo-XthhLpgvEG0XAGYhZvrhbM'
        }, function (data) {
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
                facebook.get('/me/feed', {
                    since: lastLatestTime,
                    limit: 4
                }, function (data) {
                    for (var i = 0; i < data.length; i++) {
                        var post = data[i];
                        posts.isPostOld(post, function (post, exists) {
                            if (!exists) {
                                processUserPost(post);
                                posts.setPostOld(post);
                            }
                        });
                    };
                });
            });
        });
    }
    res.send();
}

function test(req, res) {
    var deviceId='804f58aaaaaa0358';
    var action = 'On';
    var data = '<?xml version="1.0" encoding="UTF-8"?> \
    <setVoltDataRequest deviceId="'+deviceId+'" locationId="62" xmlns="http://platform.tendrilinc.com/tnop/extension/ems"> \
    <data> \
    <mode>'+action+'</mode> \
    </data> \
    </setVoltDataRequest>';

    helper.tendrilPost(
        'https://dev.tendrilinc.com/connect/device-action'
        , null
        , data
        , function (data) {
            // parse XML
            var requestId = data.match(/requestId=".+"/)[0].split('"')[1];
            
            helper.tendrilGet('https://dev.tendrilinc.com/connect/device-action/'+requestId
                , null
                , function (data) {
                    res.send(data);
                });
        });
}

app.get('/', handle_facebook_request);

app.get('/start', start_loop);
app.get('/testpost', function (req, res) {
    helper.fbPostMessage('test test test');
    res.send('sent');
});
app.get('/testpostback', function (req, res) {
    processUserPost(req.query.input);
    res.send('Got it!');
});

app.post('/', handle_facebook_request);
app.get('/webhooks/facebook', handle_subscription_verification);
app.post('/webhooks/facebook', handle_subscription_update);


function generate_uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
        v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

var app_key = 'b258166257d8d16c0ff8005bf6e61aeb';
var app_secret = '12ac4b5f60df625040f3b6e525604bb5';
var connect_url = 'https://dev.tendrilinc.com';
var request_token_url = 'https://dev.tendrilinc.com/oauth/request_token';
var authorize_url = 'https://dev.tendrilinc.com/oauth/authorize';
var access_token_url = 'https://dev.tendrilinc.com/oauth/access_token';
var callback_url = '/tendril/callback';
var another_callback_url = '/tendril/another_callback';
var extendedPermissions = 'account billing consumption';

// call be called with or without argument
function getAccessToken(cb, user2){
    tendrils.getAccessToken(function(access_token){
	cb(access_token);
    }, function(){ // weird but should work
	tendrils.getRefreshToken(function(refresh_token){
	    refreshAccessToken(refresh_token, function(data, expires_time){
		if (data){
		    getAccessToken(cb);
		}
		else{
		    throw("Need to reauth app");
		}
	    });
	});
    },
    user2); // set user2=true if want NashKato
 
}


app.get('/tendril/another_callback', function (req, res) {
    var url = connect_url + '/connect/user/current-user';
    helper.tendrilGet(url, null, function (data) {
        res.send(data);
    });
});

tendrilUsers = {
    NashKato :{
	username: 'nash.kato@tendril.com',
	password: 'password'
    } ,
    AndrewWood:{
	username :'andrew.wood@tendril.com',
	password: 'password'
    }
}

function tendrilAuth(user, req, res){ // req, res optional
    var headers = {
	'Accept': 'application/json'
    };

  
    var data ={
	'grant_type'    : 'password',
	'username'     : tendrilUsers[user].username,
	'password'      : tendrilUsers[user].password,
	'scope'         : extendedPermissions,
	'client_id'     : app_key,
	'client_secret' : app_secret,
	'route'         : 'sandbox'
    };

    
    rest.get(access_token_url, {
	query : data
    }).on('complete', 	function(data){
	    var date = new Date();
            var expires_time = new Date(date.getTime() + parseInt(data.expires_in)*1000);
	    
	    var user2 = (user == "NashKato");
	    console.log(data.access_token);
	    tendrils.addAccessToken(data.access_token, expires_time, user2);
	    tendrils.addRefreshToken(data.refresh_token, user2);
	if (res){
	    res.send('Done');
	}
	
	});
    


}

function refreshAccessToken(refresh_token, cb, user2){
    var url = access_token_url;
 
    var data = {

	'grant_type'      : 'refresh_token',
	'refresh_token'   : refresh_token,
	'scope'           : extendedPermissions
    };

    rest.get(url, {
	query: data,
	headers: headers
    }).on('complete', function(data){
	var date = new Date();
        var expires_time = new Date(date.getTime() + parseInt(data.expires_in)*1000);      
	tendrils.addRefreshToken(data.refresh_token, user2);
	tendrils.addAccessToken(data.access_token, expires_time, user2);


        cb(data, expires_time);
        
        res.send();
    });
}

app.get('/tendril/refresh', function(req,res){

    refreshAccessToken(req.session.refresh_token, function(data, expires_time){
	
        req.session.access_token = data.access_token;
        req.session.expires_in = data.expires_in;

        req.session.expires_time = expires_time;

        req.session.token_type = data.token_type;      
        req.session.refresh_token = data.refresh_token;


        req.session.scope = data.scope;
        req.session.loggedin = true;

        res.redirect('http://' + req.headers['host'] + another_callback_url, 303);
    });
});

app.get('/tendril/callback', function (req, res) {
    if (!req.query.code) {
        res.send('No code!');
    }
    

    req.session.code = req.query.code;
    req.session.check_state = req.query.state;

    var url = access_token_url;

    var data = {
        grant_type: 'authorization_code',
        code: req.session.code,
        redirect_uri: 'http://' + req.headers['host'] + another_callback_url,
        client_id: app_key,
        client_secret: app_secret
    }
    
    helper.tendrilGet(url, data, function (data) {
        req.session.access_token = data.access_token;
        req.session.expires_in = data.expires_in;

        var date = new Date();
        var expires_time = new Date(date.getTime() + parseInt(data.expires_in)*1000);

        req.session.expires_time = expires_time;

        tendrils.addAccessToken(data.access_token, expires_time);

        req.session.token_type = data.token_type;
        
        req.session.refresh_token = data.refresh_token;

        tendrils.addRefreshToken(data.refresh_token);

        req.session.scope = data.scope;

        req.session.loggedin = true;
        
        res.redirect('http://' + req.headers['host'] + another_callback_url, 303);
    });
});

app.get('/tendril/auth', function (req, res) {
    req.session.authorize_state = generate_uid();
    var auth_url = authorize_url + '?response_type=code' + '&client_id=' + app_key + '&redirect_uri=' + 'http://' + req.headers['host'] + callback_url + '&scope=' + extendedPermissions + '&state=' + req.session.authorize_state;
    res.redirect(auth_url);
});

app.get('/tendril/auth2', function(req,res){
    tendrilAuth('NashKato', req, res);

});

app.get('/test', test);
