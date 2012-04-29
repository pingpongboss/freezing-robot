// TODO: get rid of req, Jamin
function fbPostMessage(msg, req) {
	req.facebook.post(
		'/me/feed',
		{message: msg},
		function (data) {
			console.log('fbPostMessage: ' + data);
		});
}

exports.fbPostMessage = fbPostMessage;

function fbPostComment(post_id, msg, req) {
	req.facebook.post(
		post_id + '/comments',
		{message: msg},
		function (data) {
			console.log('fbPostComment: ' + data);
		});
}

exports.fbPostComment = fbPostComment;
