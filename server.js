var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var session = require('cookie-session');
var fileUpload = require('express-fileupload');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'GGWP';
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://abc123:abc123@ds111788.mlab.com:11788/381project';

app.use(fileUpload());
app.use(bodyParser.json());
app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));


app.set('view engine', 'ejs');

app.get("/", function(req,res){
	if(!req.session.authenticated){
		res.sendFile(__dirname + '/public/login.html');
	}else{
		console.log('??????????????????????????????????');
		res.redirect('/read');
	}
});

app.get("/login",function(req,res){
	if(!req.session.authenticated){
		res.sendFile(__dirname + '/public/login.html');
	}else{
		console.log('??????????????????????????????????');
		res.redirect('/read');
	}
});

app.post("/login", function(req,res){
	if(req.body.name == null){
		res.sendFile(__dirname + '/public/login.html');
	}else{
		var criteria = {};
		criteria['userid'] = req.body.name;
		MongoClient.connect(mongourl,function(err,db){
			console.log('connected to mlab.com');
			assert.equal(err,null);
			db.collection('users').findOne(criteria, function(err,doc){
				db.close();
				assert.equal(err,null);
				if(doc!=null){
					//console.log('userid: '+doc.userid+', pw: '+doc.password);
					//console.log('body.userid: '+req.body.name+', body.pw: '+req.body.password);
					if(req.body.password==doc.password){
						console.log('login success. userid: '+doc.userid);
						req.session.authenticated = true;
						req.session.userid = doc.userid;
						redirect(req,res);
						//res.redirect('/read');
					}else if(doc.password==null&&req.body.password==''){
						console.log('login success. userid: '+doc.userid);
						req.session.authenticated = true;
						req.session.userid = doc.userid;
						redirect(req,res);
						//res.redirect('/read');
					}else{
						console.log('wrong password');
						res.sendFile(__dirname + '/public/login.html');
					}
					res.end();
				}else{
					console.log('no such a user');
					res.sendFile(__dirname + '/public/login.html');
				}
			});
		});
	}
});

app.get('/register', function(req,res){
	if(!req.session.authenticated){
		res.sendFile(__dirname + '/public/register.html');
	}else{
		res.redirect('/read');
	}
});

app.post('/register', function(req,res){
	if(req.body.name!=null){
		var criteria = {};
		criteria['userid'] = req.body.name;
		if(req.body.password!=''){
			criteria['password'] = req.body.password;
		}
		
		MongoClient.connect(mongourl, function(err,db){
			assert.equal(err,null);
			db.collection('users').insertOne(criteria, function(err,doc){
				db.close();
				if(err){
					res.redirect('/register');
				}else{
					res.redirect('/login');
				}
			});
		});
	}else{
		console.log('[Register Error] Missing userid!')
		res.end();
	}

});

app.get('/logout', function(req,res){
	req.session = null;
	res.redirect('/');
});

app.get('/read', function(req,res) {
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		MongoClient.connect(mongourl, function(err,db){
			criteria = req.query;
			assert.equal(err,null);
			findMany(criteria,db,function(restaurantList){
				db.close();
				res.render("list", {restaurantList: restaurantList, criteria: JSON.stringify(req.query), userid: req.session.userid});
			});
		});
		
	}
});

app.get('/search', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		res.render("search");
	}
	
});

app.post('/search', function(req,res){
	query = '?';
	if(req.body.isNameNull!='on'){
		query = query+'name='+req.body.name+'&';
	}
	if(req.body.isCuisineNull!='on'){
		query = query+'cuisine='+req.body.cuisine+'&';
	}
	if(req.body.isBoroughNull!='on'){
		query = query+'borough='+req.body.borough+'&';
	}
	res.redirect('/read'+query);
	
	
});

app.get('/new', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		res.render("new");
	}
});

app.post('/new', function(req,res){
	var criteria = {};
	criteria['name'] = req.body.name;
	criteria['cuisine'] = req.body.cuisine;
	criteria['borough'] = req.body.borough;
	criteria['address'] = {};
	criteria['creator'] = req.session.userid;
	criteria.address['street'] = req.body.street;
	criteria.address['building'] = req.body.street;
	criteria.address['zipcode'] = req.body.zipcode;
	criteria.address['coord']=[];
	criteria.address['coord'].push(req.body.latitude);
	criteria.address['coord'].push(req.body.longitude);
	
	
	
	if(req.files.sampleFile!=null){
		criteria['data'] = new Buffer(req.files.sampleFile.data).toString('base64');
		criteria['mimetype'] = req.files.sampleFile.mimetype;
	}
	
	MongoClient.connect(mongourl, function(err,db){
		assert.equal(err,null);
		db.collection('restaurants').insertOne(criteria, function(err,result){
			db.close();
			assert.equal(err,null);
			if(err){
				console.log('insertOne Error: ' + JSON.stringify(err));
				res.redirect('/new');
			}else{
				console.log('insertOne Success, key: '+result.insertedId);
				res.redirect('/showdetails?_id='+result.insertedId);
			}
		});
	});
})

app.get('/showdetails', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		if(req.query._id==null){
			res.status(400).end('Missing _id !');
		}else{
			var criteria = {}
			criteria['_id'] = ObjectId(req.query._id);
			
			MongoClient.connect(mongourl, function(err,db){
				assert.equal(err,null);
				db.collection('restaurants').findOne(criteria, function(err,doc){
					db.close();
					assert.equal(err,null);
					if(doc!=null){
						res.render('details', {restaurant: doc});
					}else{
						res.status(404).end('Restaurant with _id '+req.query._id+' not found.');
					}
				});
			});
		}
	}
});

app.get('/update', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		if(req.query._id!=null){
			var criteria = {};
			criteria['_id'] = ObjectId(req.query._id);
			
			MongoClient.connect(mongourl, function(err,db){
				assert.equal(err,null);
				db.collection('restaurants').findOne(criteria, function(err,doc){
					db.close();
					if(doc!=null){
						if(req.session.userid == doc.creator){
							res.render('update', {restaurant: doc});
						}else{
							res.end('You have no permission to modify this document!');
						}
					}else{
						res.status(404).end('Restaurant with _id '+req.query._id+' not found.')
					}
				});
			});
		}else{
			res.end('Missing query(_id)!');
		}
	}
});

app.post('/update', function(req,res){
	var id = req.body._id;
	
	var criteria = {};
	criteria['name'] = req.body.name;
	criteria['cuisine'] = req.body.cuisine;
	criteria['borough'] = req.body.borough;
	criteria['address'] = {};
	criteria['creator'] = req.session.userid;
	criteria.address['street'] = req.body.street;
	criteria.address['building'] = req.body.street;
	criteria.address['zipcode'] = req.body.zipcode;
	criteria.address['coord']=[];
	criteria.address['coord'].push(req.body.latitude);
	criteria.address['coord'].push(req.body.longitude);

	
	if(req.body.isPhotoNull!='on'){
		criteria['data'] = new Buffer(req.files.uploadFile.data).toString('base64');
		criteria['mimetype'] = req.files.uploadFile.mimetype;
	}
	
	MongoClient.connect(mongourl, function(err,db){
		assert.equal(err,null);
		db.collection('restaurants').update(
			{"_id": ObjectId(id)},
			{$set: criteria},
			function(err,result){
				db.close();
				if(!err){
					//console.log(result);
					res.redirect('/showdetails?_id='+id);
				}else{
					res.end(JSON.stringify(err));
				}
			}
		)
	});
});

app.get('/remove', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		if(req.query._id!=null){
			// This method can avoid the crash due to find by an invalid object id.
			// Using a invalid in db operation will cause the crashing of program.
			// In this case, it will only show the error after "criteria['_id'] = ObjectId(req.query._id);".
			var criteria = {};
			criteria['_id'] = ObjectId(req.query._id);
			
			MongoClient.connect(mongourl, function(err,db){
				assert.equal(err,null);
				db.collection('restaurants').findOne(criteria, function(err,doc){
					db.close();
					if(doc!=null){
						if(req.session.userid==doc.creator){
							res.render('remove', {restaurant: doc});
						}else{
							res.end('You have no permission to remove this document!')
						}
					}else{
						res.status(404).end('Restaurant with _id '+req.query._id+' not found.')
					}
				});
			});
		}else{
			res.end('Missing query: _id');
		}
	}
});

app.post('/remove', function(req,res){
	var criteria = req.body;
	
	MongoClient.connect(mongourl, function(err,db){
		assert.equal(err,null);
		db.collection('restaurants').deleteOne({"_id": ObjectId(req.body._id)}, function(err,result){
			db.close();
			if(err){
				console.log(JSON.stringify(err));
				res.end();
			}else{
				res.redirect('/read');
			}
		});

	});
});

app.get('/rate', function(req,res){
	if(!req.session.authenticated){
		savingPage(req,res);
		res.sendFile(__dirname + '/public/login.html');
	}else{
		if(req.query._id!=null){
			var criteria = {};
			criteria['_id'] = ObjectId(req.query._id);
			
			MongoClient.connect(mongourl, function(err,db){
				assert.equal(err,null);
				db.collection('restaurants').findOne(criteria, function(err,doc){
					db.close();
					if(doc!=null){
						res.render('rate', {restaurant: doc, user: req.session.userid});
					}else{
						res.status(404).end('Restaurant with _id '+req.query._id+' not found.')
					}
				});
			});
		}else{
			res.end('Missing query(_id)!');
		}
	}
});

app.post('/rate', function(req,res){
	// Used to create the criteria: {"rating": { "score":5, "user":admin}}
	var criteria1 = {};
	var criteria2 = {};
	// Used to check whether a user rated the document or not
	var condition = {};
	
	condition['_id'] = ObjectId(req.body._id);
	condition['rating.user'] = req.body.user;
	
	criteria2['score'] = req.body.score;
	criteria2['user'] = req.body.user;
	
	criteria1['rating'] = criteria2;

	MongoClient.connect(mongourl, function(err,db){
		assert.equal(err,null);
		db.collection('restaurants').findOne(condition, function(err,doc){
			if(doc==null){
				// This function is to push the criteria to rating.
				db.collection('restaurants').updateOne({"_id":ObjectId(req.body._id)}, {$push: criteria1}, function(err,result){
					db.close();
					if(!err){
						res.redirect('/showdetails?_id='+req.body._id);
					}else{
						res.end();
					}
				});
			}else{
				res.end('You have already rated this restaurant!');
				/*
				// Disabled because each user can only rate once.
				// This function can modify the score.
				db.collection('restaurants').updateOne({"_id":ObjectId(req.body._id), "rating.user":req.body.user}, {$set: {"rating.$.score":req.body.score}}, function(err,result){
					db.close();
					console.log(result);
					if(!err){
						res.redirect('/showdetails?_id='+req.body._id);
					}else{
						res.end();
					}
				});
				*/
				
			}
		});

	});
});

app.get('/api/read/:field/:value', function(req,res){
	var criteria = {};
	criteria[req.params.field] = req.params.value;
	
	MongoClient.connect(mongourl, function(err,db){
		assert.equal(err,null);
		findMany(criteria,db,function(restaurantList){
			db.close();
			if(restaurantList.length<1){
				res.send({});
			}else{
				res.json(restaurantList);
			}
			
		});
	});
});

app.post('/api/create', function(req,res){
	// Case 1: curl -X POST -d "name=123&coord=[1,2]&borough=Hong Kong" localhost:8099/api/create
	// Case 2: curl -X POST localhost:8099/api/create -d "{\"name\":\"123\"}" -H "Content-type: application/json"
	//     OR: curl -X POST localhost:8099/api/create -d "{\"name\":123}" -H "Content-type: application/json"
	//     OR: curl -X POST localhost:8099/api/create -d "{\"name\":\"KKK\", \"address\":{\"street\":\"Bad Street\",\"coord\":[2,3]}}"  -H "Content-type: application/json"
	if(req.body.name!=null){
		//console.log('case1');
		var criteria = {};
		criteria['name'] = req.body.name;
		criteria['cuisine'] = (req.body.cuisine!=null) ? req.body.cuisine : null;
		criteria['borough'] = (req.body.borough!=null) ? req.body.borough : null;
		criteria['address'] = {};
		criteria.address['street'] = (req.body.street!=null) ? req.body.street : null;
		criteria.address['building'] = (req.body.building!=null) ? req.body.building : null;
		criteria.address['zipcode'] = (req.body.zipcode!=null) ? req.body.zipcode : null;
		criteria.address['coord'] = [];

		if(req.body.coord!=null){
			var coord = req.body.coord.substr(1,req.body.coord.length-2);
			coord = coord.split(',');
			coord[0] = parseFloat(coord[0].trim());
			coord[1] = parseFloat(coord[1].trim());

			criteria.address['coord'].push( (!isNaN(coord[0])&&coord[0]!=null) ? coord[0] : null);
			criteria.address['coord'].push( (!isNaN(coord[1])&&coord[1]!=null) ? coord[1] : null);
		}
		
		MongoClient.connect(mongourl, function(err,db){
			assert.equal(err,null);
			db.collection('restaurants').insertOne(criteria, function(err,result){
				db.close();
				assert.equal(err,null);
				if(err){
					console.log('insertOne Error: ' + JSON.stringify(err));
					res.send({"status":"failed"});
				}else{
					console.log('insertOne Success, key: '+result.insertedId);
					res.send({"status":"200","_id":result.insertedId});
				}
			});
		});
	
	}else{
		// Case 2: name field not exist 
		res.send({"status":"failed"});
	}
});

app.post('/testjson', function(request, response){
  console.log(request.body);      // your JSON
  response.send(request.body);    // echo the result back
});

app.get('/testnull', function(req,res){
	var a=null;
	if(!a){
		console.log('1');
	}else{
		console.log('2');
	}
});


function findMany(criteria,db,callback){
	var restaurantList = [];
	var cursor = db.collection('restaurants').find(criteria);
	cursor.each(function(err,doc){
		if(doc!=null){
			restaurantList.push(doc)
		}else{
			callback(restaurantList);
		}
	});
}

function savingPage(req,res){
	req.session.previousPage = req.url;
	//req.session.previousPath = req.path;
	//req.session.previousQuery = req.query;
	console.log('Saving url: '+req.session.previousPage);
}

function redirect(req,res){
	if(req.session.previousPage==null || req.session.previousPage==''){
		res.redirect('/');
	}else{
		res.redirect(req.session.previousPage);
	}
}

/*
app.get('/showdetails', function(req,res) {
	if (req.query.id != null) {
		for (var i=0; i<products.length; i++) {
			if (products[i].id == req.query.id) {
				var product = products[i];
				break;
			}
		}
		if (product != null) {
			res.render('details', {c: product});
		} else {
			res.status(500).end(req.query.id + ' not found!');
		}
	} else {
		res.status(500).end('id missing!');
	}
});

app.get('/shoppingcart', function(req,res) {
	res.end('coming soon!')
});

app.get('/add2cart', function(req,res) {
	res.end('coming soon!')
})

app.get('/emptycart',function(req,res) {
	res.end('coming soon!')
})
*/

app.listen(process.env.PORT || 8099);
