var util = require ('util');
var mysql = require('mysql');

var rdshost = '';
var rdsuser = '';
var rdspass = '';
var oss_public_host = ''; 

var pool = mysql.createPool({host:rdshost, user:rdsuser, password:rdspass, database:'flrms', port:3306});
var express = require('express');
var app = express();

var request = require('request');


//get curator article feed
app.get('/curatorfeed', function(req, res) {
    var page = req.query.page;
    var page_size = req.query.page_size;
    if(!page_size)
       page_size = 6;
	
    if(!page) {
       res.send('Bad request');
    } else {
       pool.getConnection(function(err, connection) {
          if(err)
		res.send(err);
	  else {
                var query = util.format('SELECT * from article where reviewed=0 and health=1 ORDER BY publishtime LIMIT %d, %d;', page*page_size, page_size); 

	         connection.query(query, function(err, rows) {
		      connection.release();
		      if(!err) {
			 if(rows)
			     res.send(rows);
			 else
			     res.send('Not found');
		      } else {
			  res.send(err);
		      }
		}); 
	  }
      });
   }
});

//get curator article feed
app.get('/homefeed', function(req, res) {
    var page = req.query.page;
    var page_size = req.query.page_size;
    if(!page_size)
       page_size = 6;
	
    if(!page) {
       res.send('Bad request');
    } else {
       pool.getConnection(function(err, connection) {
          if(err)
		res.send(err);
	  else {
                var query = util.format('SELECT * from article where health=1 ORDER BY publishtime LIMIT %d, %d;', page*page_size, page_size); 

	         connection.query(query, function(err, rows) {
		      connection.release();
		      if(!err) {
			 if(rows)
			     res.send(rows);
			 else
			     res.send('Not found');
		      } else {
			  res.send(err);
		      }
		}); 
	  }
      });
   }
});


//get one site and update timestamp
app.get('/getatomicsite', function(req, res) {
	
    pool.getConnection(function(err, connection) {
          if(err)
		res.send(err);
	  else {
                 var query = util.format('SELECT * from website where hidden=0 ORDER BY date_updated LIMIT 1;'); 

	         connection.query(query, function(err, select_rows) {
		      if(!err) {
			 if(select_rows) {
            	             var query = util.format('UPDATE website set date_updated=NOW() where siteid=\"%s\";', select_rows[0]['siteid']); 
				
	         	     connection.query(query, function(err, update_rows) {
		                 connection.release();
				 if(!err) {
			             res.send(select_rows);
				 } else {
			             res.send(err);
				 }
			     });
			 } else {
		             connection.release();
			     res.send('Not found');
			 }
		      } else {
		          connection.release();
			  res.send(err);
		      }
		}); 
	  }
    });
});

//get site feed
app.get('/sitefeed', function(req, res) {
    var page = req.query.page;
    var page_size = req.query.page_size;
    if(!page_size)
       page_size = 6;
	
    if(!page) {
       res.send('Bad request');
    } else {
       pool.getConnection(function(err, connection) {
          if(err)
		res.send(err);
	  else {
                 var query = util.format('SELECT * from website hidden=0 ORDER BY date_updated LIMIT %d, %d;', page*page_size, page_size); 

	         connection.query(query, function(err, rows) {
		      connection.release();
		      if(!err) {
			 if(rows) {
			     res.send(rows);
			 } else {
			     res.send('Not found');
			 }
		      } else {
			  res.send(err);
		      }
		}); 
	  }
      });
   }
});


//update site info
app.get('/siteupdate', function(req, res) {
   var siteid = req.query.siteid;
    
   if(!siteid) {
       res.send('Bad request');
   } else {
      
       pool.getConnection(function(err, connection) {
              if(err)
            	res.send(err);
              else {
            	var query = util.format('UPDATE website set date_updated=NOW() where siteid=\"%s\";', siteid); 
              
            	connection.query(query, function(err, rows) {
            	      connection.release();
            	      if(!err)
            		  res.send('ok');
            	      else
            		  res.send(err);
            	}); 
              }
       });
   }
});


//get article info
app.get('/getarticle', function(req, res) {
   var articleid = req.query.articleid;
    
   if(!articleid) {
       res.send('Bad request');
   } else {
      
       pool.getConnection(function(err, connection) {
              if(err)
            	res.send(err);
              else {
            	var query = util.format('SELECT * from article where articleid=\"%s\";', articleid); 
              
            	connection.query(query, function(err, rows) {
            	      connection.release();
            	      if(!err) {
			if(rows[0])
            		    res.send(rows[0]);
			else
			    res.send('Not found');
		      }
            	      else
            		res.send(err);
            	}); 
              }
       });
   }
});

//post article info
app.get('/postarticle', function(req, res) {
   var articleid = req.query.articleid;
   var siteid = req.query.siteid;
   var url = req.query.url;
   var title = req.query.title;
   var excerpt = req.query.excerpt;
   var publishtime = req.query.publishtime;
   var contenturl = req.query.contenturl;
   var imgurl = req.query.imgurl;
   var topics = req.query.topics;
   console.log(articleid, url, title, excerpt, publishtime, contenturl);
    
   if(!siteid || !articleid || !url || !title || !publishtime || !contenturl ||!topics || !imgurl) {
       res.send('Bad request');
   } else {
      
       pool.getConnection(function(err, connection) {
              if(err) {
            	  res.send(err);
              } else {
	          var query = util.format('INSERT INTO article(articleid, siteid, url, title, excerpt, publishtime, contenturl, imgurl, topics) VALUES(\"%s\", \"%s\", \"%s\", \"%s\", \"%s\", FROM_UNIXTIME(\"%d\"), \"%s\", \"%s\", \"%s\");', articleid, siteid, url, title, excerpt, publishtime, contenturl, imgurl, topics); 
              
            	  connection.query(query, function(err, rows) {
            	      connection.release();
            	      if(!err)
            		 res.send('ok');
            	      else
            		 res.send(err);
            	 }); 
              }
       });
   }
});

//add article img 
app.get('/addimg', function(req, res) {
   var articleid = req.query.articleid;
   var imgurl = req.query.imgurl;

   if(!articleid || !imgurl) {
       res.send('Bad request');
   } else {

	pool.getConnection(function(err, connection) {
              if(err) {
            	  res.send(err);
              } else {
	          var query = util.format('SELECT coverimgurl FROM article where articleid=\"%s\";', articleid); 
            	  connection.query(query, function(err, rows) {
            	       if(!err) {
			   var coverimgurl = rows[0]['coverimgurl'];
			   var arr = [];
			   var newimgurl = '';
			   if(coverimgurl != null) {
				arr = coverimgurl.split('|');
				if(arr.length >= 3) {
					connection.release();
					res.send('full');
					return;
				}
			   }
			   if(arr.length==0) {
				newimgurl = imgurl;
			   } else {
				newimgurl = imgurl+'|'+coverimgurl;
			   }

	          	   var query = util.format('UPDATE article set coverimgurl=\"%s\" where articleid=\"%s\";', newimgurl, articleid); 
            	           connection.query(query, function(err, rows) {
            	  	        connection.release();
            	       		if(!err) {
            		   	    res.send('ok');
				} else {
            		   	    res.send(err);
				}
			   });
            	       } else {
            	  	   connection.release();
            		   res.send(err);
		       }
            	 }); 
              }
       });
   }

});

//set article health 
app.get('/sethealth', function(req, res) {
   var articleid = req.query.articleid;
   var health = req.query.health;

   if(!articleid || !health) {
       res.send('Bad request');
   } else {

	pool.getConnection(function(err, connection) {
              if(err)
            	res.send(err);
              else {
	          var query = util.format('UPDATE article set health=%d where articleid=\"%s\";', health, articleid); 

            	  connection.query(query, function(err, rows) {
            	      connection.release();
            	      if(!err)
            		 res.send('ok');
            	      else
            		 res.send(err);
            	 }); 
              }
       });
   }

});


app.get('/article?', function(req, res) {
   var articleid = req.query.articleid;
});


var port = 8800;
app.listen(port, function() {
    console.log('Starting hunter service on:', port);
});
