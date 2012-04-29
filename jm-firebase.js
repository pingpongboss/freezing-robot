var Firebase = require('./firebase-node');

var ENDPOINT = 'http://gamma.firebase.com/jmwong/';

var TENDRILS_LOCATION = 'tendrils';

var USERS_LOCATION = 'users';
var POSTS_LOCATION = 'posts';


var tendrils = function(){
    var db = new Firebase(ENDPOINT);
    var tendrilsRoot = db.child(TENDRILS_LOCATION);

    var ref = tendrilsRoot.child('access_token');

    var codeRef = tendrilsRoot.child('code');

    this.addRefreshToken = function(refresh_token){
	codeRef.set({refresh_token: refresh_token});
    };
    
    this.getRefreshToken = function(success, failure){
	codeRef.once('value', function(snapshot){
	    var val = snapshot.val();
	    var exists = (val !== null);
	    if (exists){
		if (success){
		    success(val);
		}
	    }else{
		if (failure){
		    failure(val);
		}
	    }
	});
    };


    this.addAccessToken = function(access_token, expires){
	ref.set({'access_token': access_token, expires: expires});
    };

    this.getAccessToken = function(success, failure){
	ref.once('value', function(snapshot){
	    var val = snapshot.val();
	    var exists = (val !== null);
	    if (exists){
		if (success){
		    success(val.access_token);
		}
	    }else{
		if (failure){
		    failure(val);
		}
	    }
	});
    };

    return this;
}

var users = function () {
	var db = new Firebase(ENDPOINT);
	console.log(db);
	var usersRef = db.child(USERS_LOCATION);


	this.addUser = function (fbId, access_token, cb) {
		console.log("ADDING USER");
		console.log(fbId);
		usersRef.child(fbId).transaction(function (data) {
                //if (data === null){
                	return {
                		'access_token': access_token
                	}
                //} 
            }, function (success) {
            	if (cb) {
            		cb(success);
            	}
            });
	};



	this.getUser = function (fbId, success, failure) {
		usersRef.child(fbId).once('value', function (snapshot) {
			var val = snapshot.val();
			var exists = (val !== null);
			if (exists) {
				success(val);
			} else {
				if (failure) {
					failure(val);
				}
			}
		});
	}

	return this;

}

var posts = function () {
	var db = new Firebase(ENDPOINT);
	console.log(db);
	var ref = db.child(POSTS_LOCATION);


	this.setLatestTime = function (time) {
		console.log("ADDING Latest Time");
		console.log(time);

		ref.child('latest').set(time);
	};

	this.getLatestTime = function (callback) {
		ref.child('latest').once('value', function (snapshot) {
			var val = snapshot.val();
			var exists = (val !== null);
			callback(val);
		});
	}

	this.isPostOld = function (post, callback) {
		ref.child('old').child(post.id).once('value', function (snapshot) {
			var exists = (snapshot.val() !== null);
			callback(post, exists);
		});
	}

	this.setPostOld = function (post) {
		ref.child('old').child(post.id).set('true');
	}

	return this;
}

module.exports.users = users;
module.exports.posts = posts;
module.exports.tendrils = tendrils;