var faceplateOptions = {
    extend_access_token: true,
    persist_access_token: true,
    app_id: process.env.FACEBOOK_APP_ID || '301282389949117',
    secret: process.env.FACEBOOK_SECRET || 'edcc1c9ede78eb15bc773fed78602619',
    scope:  'user_likes,user_photos,user_photo_video_tags,read_stream,publish_stream'
};
var nonbrowser = require('./lib/faceplate').nonbrowser(faceplateOptions);
var fbId = '100003794911765';

function fbPostMessage(msg) {
	facebook(function (facebook) {
		facebook.post(
			'/me/feed',
			{message: msg},
			function (data) {
				console.log('fbPostMessage:', data);
			});
	});
}

function fbPostComment(post_id, msg, req) {
	req.facebook.post(
		post_id + '/comments',
		{message: msg},
		function (data) {
			console.log('fbPostComment: ' + data);
		});
}

function facebook(callback) {
	nonbrowser(fbId, function(facebook){
		callback(facebook);
	});
}

exports.fbPostMessage = fbPostMessage;
exports.fbPostComment = fbPostComment;
exports.facebook = facebook;
exports.faceplateOptions = faceplateOptions;
