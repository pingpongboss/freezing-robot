var Firebase = require('./firebase-node');

var ENDPOINT = 'http://gamma.firebase.com/jmwong/';

var USERS_LOCATION = 'users';
var POSTS_LOCATION = 'posts';



var users = function(){
    var db = new Firebase(ENDPOINT);   
    console.log(db);
    var usersRef = db.child(USERS_LOCATION);


    this.addUser = function(fbId, access_token, cb){
	console.log("ADDING USER");
	console.log(fbId);
	usersRef.child(fbId).transaction(function(data){
	    //if (data === null){
		return {'access_token': access_token}
	    //} 
	}, function(success){
	    if (cb){
		cb(success);
	    }
	});
    };



    this.getUser = function(fbId, success, failure){
	usersRef.child(fbId).once('value', function(snapshot){
	    var val = snapshot.val();
	    var exists = (val !== null);
	    if (exists){
		success(val);
	    }
	    else{
		if (failure){
		    failure(val);
		}
	    }
	});
    }

    return this;
    
}

var posts = function(){
	var db = new Firebase(ENDPOINT);   
	console.log(db);
	var ref = db.child(POSTS_LOCATION);


	this.setLatestTime = function(time){
		console.log("ADDING Latest Time");
		console.log(time);
		
		ref.set({
			latest 	: time,
		});
	};

	this.getLatestTime = function(callback){
		ref.once('latest', function(snapshot){
			var val = snapshot.val();
			var exists = (val !== null);
			callback(val);
		});
	}
	
	this.isPostOld = function(post, callback) {
		ref.child('old').child(post.id).once('value', function (snapshot) {
			var exists = (snapshot.val() !== null);
			callback(post, exists);
		});
	}
	
	this.setPostOld = function(post) {
		ref.child('old').child(post.id).set('true');
	}

    return this;
}

module.exports.users = users;
module.exports.posts = posts;