var Firebase = require('./firebase-node');

var ENDPOINT = 'http://gamma.firebase.com/jmwong/';

var USERS_LOCATION = 'users';



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

module.exports.users = users;






