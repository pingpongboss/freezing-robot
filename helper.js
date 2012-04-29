// TODO: get rid of req, Jamin
function fbPostMessage(msg, req) {
	req.facebook.post(
		'/me/feed'
		,{
			message: msg
		}
		,function (data) {
			console.log('fbPostMessage: ' + data);
		});
}

exports.fbPostMessage = fbPostMessage;