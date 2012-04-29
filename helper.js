var tendrils = require('./jm-firebase.js').tendrils();
var nonbrowser = require('./lib/faceplate').nonbrowser(faceplateOptions);
var rest = require('restler');
var faceplateOptions = {
	extend_access_token: true,
	persist_access_token: true,
	app_id: '290427237712179',
	secret: '372ddf9dbff0853030a779f9db26c072',
	scope: 'user_likes,user_photos,user_photo_video_tags,read_stream,publish_stream,user_relationships'
};
var fbId = '100003794911765';


function fbPostMessage(msg) {
	facebook(function (facebook) {
		facebook.post('/me/feed', {
			message: msg
		}, function (data) {
			console.log('fbPostMessage: ', data);
		});
	});
}

function fbPostComment(post_id, msg) {
	facebook(function (facebook) {
		facebook.post(
			post_id + '/comments', {
				message: msg
			}, function (data) {
				console.log('fbPostComment: ' + data);
			});
	});
}

function facebook(callback) {
	nonbrowser(fbId, function (facebook) {
		callback(facebook);
	});
}

function isFamily (fromId, callback) {
	facebook(function (facebook) {
		facebook.get('/me/family', function (data) {
			for (var i = 0; i < data.length; i++) {
				var member = data[i];
				if (member.id === fromId) {
					callback(true);
					return;
				}
			};
			callback(false);
		});
	});
}

function twitterPostMessage(msg, callback) {
	T.post('statuses/update', { status: msg }, function(err, reply) {
		console.log('twitterPostMessage: ' + reply);
		callback(reply);
	});
}

// call be called with or without argument
function getAccessToken(cb){
	tendrils.getAccessToken(function(access_token){
		cb(access_token);
    }, function(){ // weird but should work
    	refreshAccessToken(function(data, expires_time){
    		if (data){
    			getAccessToken(cb);
    		}
    		else{
    			throw("Need to reauth app");
    		}
    	});
    });    
}

// TODO jamin get rid of req
function tendrilGet(url, query, callback) {
	getAccessToken(function(access_token){
		var headers = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Access_Token': access_token
		};

		rest.get(url, {
			query: query,
			headers: headers,
		}).on('complete', function (data) {
			callback(data);
		});
	});
}

// TODO jamin get rid of req
function tendrilPost(url, query, data, callback) {
	getAccessToken(function(access_token){
		var headers = {
			'Accept': 'application/xml',
			'Content-Type': 'text/xml',
			'Access_Token': access_token
		};

		rest.post(url, {
			query: query,
			data: data,
			headers: headers,
		}).on('complete', function (data) {
			callback(data);
		});
	});
}

function contains() {
	console.log('contains args', arguments);
	var text = arguments[0].toUpperCase();
	for (var i = 1; i < arguments.length; i++) {
		var filters = arguments[i];
		var found = false;
		for (var j = 0; j < filters.length; j++) {
			var filter = filters[j].toUpperCase();
			if (text.indexOf(filter) != -1) {
				found = true;
				break;
			}
		};

		if (!found) {
			return false;
		}
	};

	return true;
}


//bool
function manageLight(on, callback) {
	var deviceId='804f58aaaaaa0358';
	var action = on ? 'On' : 'Off';
	var data = '<?xml version="1.0" encoding="UTF-8"?> \
	<setVoltDataRequest deviceId="'+deviceId+'" locationId="62" xmlns="http://platform.tendrilinc.com/tnop/extension/ems"> \
	<data> \
	<mode>'+action+'</mode> \
	</data> \
	</setVoltDataRequest>';

	tendrilPost(
		'https://dev.tendrilinc.com/connect/device-action'
		, null
		, data
		, function (data) {
            // parse XML
            var requestId = data.match(/requestId=".+"/)[0].split('"')[1];
            
            tendrilGet('https://dev.tendrilinc.com/connect/device-action/'+requestId
            	, null
            	, function (data) {
            		callback(data);
            	});
        });
}

exports.fbPostMessage = fbPostMessage;
exports.fbPostComment = fbPostComment;
exports.facebook = facebook;
exports.faceplateOptions = faceplateOptions;
exports.isFamily = isFamily;
exports.twitterPostMessage = twitterPostMessage;
exports.tendrilGet = tendrilGet;
exports.tendrilPost = tendrilPost;
exports.manageLight = manageLight;
exports.contains = contains;