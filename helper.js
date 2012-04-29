var nonbrowser = require('./lib/faceplate').nonbrowser(faceplateOptions);
var rest = require('restler');
var faceplateOptions = {
	extend_access_token: true,
	persist_access_token: true,
	app_id: '290427237712179',
	secret: '372ddf9dbff0853030a779f9db26c072',
	scope: 'user_likes,user_photos,user_photo_video_tags,read_stream,publish_stream'
};
var fbId = '100003794911765';
var Twit = require('twit');
var T = new Twit({
    consumer_key:         'NmCRPoeyNoV3xGyck5jeIA'
  , consumer_secret:      'F3IkEmtrNCGfH5E3858MU7BOforCKxTK5TESOD0Zs'
  , access_token:         '566262754-OG3H23OMQCauPJAfXjmQS8JVwVOzvvcRwZHX6Hom'
  , access_token_secret:  '8ZxYxglKfZwJ0oe90UU02qXXLlglEcJNQ7vClZbYQ'
});

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

function twitterPostMessage(msg) {
	T.post('statuses/update', { status: msg }, function(err, reply) {
	  console.log('twitterPostMessage: ' + reply);
	});
}

// TODO jamin get rid of req
function tendrilGet(url, query, req, callback) {
	var headers = {
	    'Accept': 'application/json',
	    'Content-Type': 'application/json',
	    'Access_Token': req.session.access_token
	};

	rest.get(url, {
		query: query,
	    headers: headers,
	}).on('complete', function (data) {
		callback(data);
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

exports.fbPostMessage = fbPostMessage;
exports.fbPostComment = fbPostComment;
exports.facebook = facebook;
exports.faceplateOptions = faceplateOptions;
exports.twitterPostMessage = twitterPostMessage;
exports.tendrilGet = tendrilGet;
exports.contains = contains;