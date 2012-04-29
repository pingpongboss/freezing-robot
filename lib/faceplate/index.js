var b64url  = require('b64url');
var crypto  = require('crypto');
var qs      = require('querystring');
var restler = require('restler');
var util    = require('util');

var users = require('../../jm-firebase').users();

var Faceplate = function(options) {

    var self = this;

    this.options = options || {};
    this.app_id  = this.options.app_id;
    this.secret  = this.options.secret;
    
    this.extend_access_token = this.options.extend_access_token || false;
    this.persist_access_token = this.options.persist_access_token || false;

    this.nonbrowser_session = function(fbId, cb){
	console.log("NON BROWSER");
	users.getUser(fbId, 
		      function(data){
			  var session = new FaceplateSession(self, data.access_token);
			  console.log(session);
			  cb(session);
		      },
		      function(){
			  throw ("No user with " + fbId + " in db.");
		      });	
    };
    
    this.middleware = function() {
	return function(req, res, next) {
	    if (req.body.signed_request) {
		self.parse_signed_request(req.body.signed_request, function(token) {
		    req.facebook = new FaceplateSession(self, token);
		    next();
		});
	    } else if (req.cookies["fbsr_" + self.app_id]) {
		self.parse_signed_request(req.cookies["fbsr_" + self.app_id], function(token) {
		    req.facebook = new FaceplateSession(self, token);
		    next();
		});
	    } else {
		req.facebook = new FaceplateSession(self);
		next();
	    }
	}
    }

    this.get_long_access_token = function(short_access_token, cb, fbId){
	
	/*https://graph.facebook.com/oauth/access_token?             
	  client_id=APP_ID&
	  client_secret=APP_SECRET&
	  grant_type=fb_exchange_token&
	  fb_exchange_token=EXISTING_ACCESS_TOKEN */
	
	var params = {
	    client_id:     self.app_id,
	    client_secret: self.secret,
	    grant_type: 'fb_exchange_token',
	    fb_exchange_token: short_access_token
	};
	
	var request = restler.get('https://graph.facebook.com/oauth/access_token', { query:params });

	request.on('fail', function(data) {
	    var result = JSON.parse(data);
	    console.log('invalid code: ' + result.error.message);
	    cb();
	});
	
	request.on('success', function(data) {
	    var parsed = qs.parse(data);
	    console.log("Access token expiring in (s): "+parsed.expires);
	    if (self.persist_access_token){
		users.addUser(fbId, short_access_token);
	    }
	    cb(parsed.access_token);
	    
	    
	});
    }

    this.parse_signed_request = function(signed_request, cb) {
	var extend_access_token = this.extend_access_token;

	var encoded_data = signed_request.split('.', 2);

	var sig  = encoded_data[0];
	var json = b64url.decode(encoded_data[1]);
	var data = JSON.parse(json);

	
	// check algorithm
	if (!data.algorithm || (data.algorithm.toUpperCase() != 'HMAC-SHA256')) {
	    throw("unknown algorithm. expected HMAC-SHA256");
	}

	// check signatureconsole.log(extend_access_token)
	var secret = self.secret;
	var expected_sig = crypto.createHmac('sha256', secret).update(encoded_data[1]).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace('=','');

	if (sig !== expected_sig)
	    throw("bad signature");

	// not logged in
	if (!data.user_id) {
	    cb();
	    return;
	}

	if (data.oauth_token) {
	    cb(data.oauth_token);
	    return;
	}

	if (!data.code)
	    throw("no oauth token and no code to get one");

	var params = {
	    client_id:     self.app_id,
	    client_secret: self.secret,
	    redirect_uri:  '',
	    code:          data.code
	};

	var request = restler.get('https://graph.facebook.com/oauth/access_token', { query:params });

	request.on('fail', function(data) {
	    var result = JSON.parse(data);
	    console.log('invalid code: ' + result.error.message);
	    cb();
	});

	request.on('success', function(respData) {
	    var parsed = qs.parse(respData);

	    var short_access_token = parsed.access_token;
	    
	    
	    
	    if (!extend_access_token){
		console.log("Access token expiring in (s): "+parsed.expires);
		if (self.persist_access_token){
		    users.addUser(data.user_id, short_access_token);
		}
		cb(short_access_token);
	    }
	    else{
		self.get_long_access_token(short_access_token, cb, data.user_id);
	    }
	});
    }
}

var FaceplateSession = function(plate, token) {

    var self = this;

    this.plate = plate;
    this.token  = token;

    this.app = function(cb) {
	self.get('/' + self.plate.app_id, function(app) {
	    cb(app);
	});
    }

    this.me = function(cb) {
	if (self.token) {
	    self.get('/me', function(me) {
		cb(me);
	    });
	} else {
	    cb();
	}
    }

    this.get = function(path, params, cb) {
	if (cb === undefined) {
	    cb = params;
	    params = {};
	}

	if (self.token)
	    params.access_token = self.token;

	restler.get('https://graph.facebook.com' + path, { query: params }).on('complete', function(data) {
	    var result = JSON.parse(data);
	    cb(result.data ? result.data : result);
	});
    }

    this.fql = function(query, cb) {
	restler.get('https://api.facebook.com/method/fql.query', { query: { access_token: self.token, query:query, format:'json' } }).on('complete', function(data) {
	    cb(data);
	});
    }

  this.post = function(path, params, cb) {
   if (cb === undefined) {
     cb = params;
     params = {};
   }

   if (self.token && !params.access_token)
     params.access_token = self.token;
   
   console.log('facebook post: ' + path + ' params: ' + params);
   restler.post('https://graph.facebook.com' + path, { data: params }).on('complete', function(data) {
     var result = JSON.parse(data);
     cb((result && result.data) ? result.data : result);
   });
 }

}

module.exports.middleware = function(options) {
    return new Faceplate(options).middleware();
}

module.exports.nonbrowser = function(options){
    return new Faceplate(options).nonbrowser_session;
}
