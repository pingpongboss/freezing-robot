var faceplateOptions = {
    extend_access_token: true,
    persist_access_token: true,
    app_id: '290427237712179',
    secret: '372ddf9dbff0853030a779f9db26c072',
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

function fbPostComment(post_id, msg) {
	facebook(function (facebook) {
		facebook.post(
			post_id + '/comments',
			{message: msg},
			function (data) {
				console.log('fbPostComment: ' + data);
			});
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
