var http = require('http');
var url = require('url');
var fs = require('fs');
var util = require ('util');
var Nightmare = require('nightmare');
var RSS = require('rss');
var moment = require('moment');
var co = require('co');
var OSS = require('ali-oss');
var crypto = require('crypto');
var request = require('request');
var download = require('download-file');
var parser = require('rss-parser');
var ffmpeg = require('fluent-ffmpeg');
var nodejieba = require('nodejieba');

var easyimg = require('easyimage');
var standard_ratio = 3/2;
var standard_width = 300;
var standard_height = 200;


var hunter_server_host = '';
var oss_public_host = ''; 
var oss_region = '';
var oss_accessKeyId = '';
var oss_accessKeySecret = '';
var oss_bucket = '';

var topN = 10;

function ossuploadBuffer(target, buffer)
{
     var ossClient = new OSS({
         region: oss_region,
         accessKeyId: oss_accessKeyId,
         accessKeySecret: oss_accessKeySecret,
	 bucket: oss_bucket 
     });

     co(function* () {
         var result = yield ossClient.put(target, new Buffer(buffer)); 
     }).catch(function(err) {
	 ossuploadBuffer(target, buffer);
	 return;
     });

     co(function* () {
         var result = yield ossClient.head(target);
         var length = parseInt(result.res.headers['content-length']);
         if (length > 0) {
            console.log('succeed uploading ', target, 'size:', length);
         } else {
            ossuploadBuffer(target, source);
            return;
         }
     }).catch(function(err) {
         ossuploadBuffer(target, source);
         return;
     });
}

function queryWebSite(siteid, hosturl, feed_block_selector, article_url_selector, article_title_selector, article_excerpt_selector, article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector) 
{
   fs.mkdir('./'.concat(siteid), 0777, function(err) {
        var queryWeb = Nightmare({ show: false, gotoTimeout: 60000 })
        queryWeb 
      	    .goto(hosturl)
	    .evaluate( function(feed_block_selector, article_url_selector, article_title_selector, article_excerpt_selector) {

		function queryDomString(node, selector) {
		   if(!selector)
			return null;
		   if(selector.indexOf('/') > -1) {
			var arr = selector.split('/');
			var i=0;
			while(i < arr.length-1) {
			   if(node.querySelector(arr[i])) {
			        node = node.querySelector(arr[i]);
			        i++;
			   } else {
				return null;
			   }
			}
			return queryDomString(node, arr[i]);
		   } else if(selector.indexOf('$') > -1) {
			var arr = selector.split('$');
			if(node.querySelector(arr[0])) {
		           return node.querySelector(arr[0]).getAttribute(arr[1]);
			} else {
			   return null;
			}
		   } else if(selector.indexOf('\\') > -1) {
			var arr = selector.split('\\');
			var selectNode = node.querySelector(arr[0]);
			if(selectNode) {
			   for(var i=1; i<arr.length; i++) {
			       var nodeToRemove = selectNode.querySelector(arr[i]);
			       if(nodeToRemove) {
			          nodeToRemove.parentNode.removeChild(nodeToRemove);
			       }
			   }
		           return selectNode.innerHTML;
			} else {
			   return null;
			}
		   } else if (selector.indexOf('@') > -1) {
			var arr = selector.split('@');
			var key = arr[1];
			var start = parseInt(arr[2]);
			var end = parseInt(arr[3]);
			if(node.querySelector(arr[0])) {
		            var str = node.querySelector(arr[0]).innerHTML;
			    
			    var keyIndex = str.indexOf(key);
			    if(keyIndex > -1 && keyIndex+start > -1 && keyIndex+end<=str.length) {  
			        return str.slice(keyIndex+start, keyIndex+end);
			    } else {
				return null;
			    }
			} else {
			    return null;
			}
		   } else {
			var selectNode = node.querySelector(selector);
			if(selectNode) {
			   return selectNode.innerHTML;
			} else {
			   return null;
			}
		   }
		}

		var block_list = document.querySelectorAll(feed_block_selector);
		var result = [];
		for(var i=0; i<block_list.length; i++) {
		   var url = queryDomString(block_list[i], article_url_selector); 
		   var title = queryDomString(block_list[i], article_title_selector); 
		   var excerpt = queryDomString(block_list[i], article_excerpt_selector);

		   var object = new Object();
		   object['url'] = url;
		   object['title'] = title;
		   object['excerpt'] = excerpt;
		   result.push(object);
		}
		return result;
	    }, feed_block_selector, article_url_selector, article_title_selector, article_excerpt_selector )
            .end()
            .then(function (result) {
	        websiteUpdate(siteid);	

		for(var i=0; i<result.length; i++) {
		   var item = result[i];
		   if(item['url']==null || item['title']==null) {
			continue;
		   }

		   var guid_src = siteid.concat('#',item['title']);
	     	   var md5 = crypto.createHash('md5');
	     	   md5.update(guid_src);
	     	   var guid = md5.digest('hex');
	
		   queryAndPostArticle(siteid, guid, filterHTML(item['url']), filterHTML(item['title']), limitLength(filterHTML(item['excerpt']), 255), article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector); 
		}
	    })
	    .catch(function (error) {
	        console.log('failed query website:', siteid, error);
            });
   });
}

function limitLength(text, len)
{
   if(!text)
      return null;
   if(text.length > len) {
      return text.slice(0, len);
   } else {
      return text;
   }
}

function filterHTML(text)
{
   var shouldFilter = false;
   var result = '';
   if(!text)
      return null;
   else {
      var str = util.format('%s', text);
      str = str.replace(/&nbsp;/g, '');
      str = str.replace(/&amp;/g, '');
      str = str.replace(/\n/g, '');

      for(var i=0; i<str.length; i++) {
	 if(str[i]=='<')
            shouldFilter = true;
	 if(!shouldFilter) {
	    if(str[i]=='\"')
		result += '\\';
	    result += str[i]; 
	 }
	 if(str[i]=='>')
            shouldFilter = false;
      }

      return result;
   }
}


function setHealth(articleid, health)
{
    var posturl = util.format('%s/sethealth?articleid=%s&health=%d',
			    hunter_server_host,
			    encodeURIComponent(articleid), 
			    health
		  ); 
		
    var options = {
	url: posturl,
	timeout: 10000
    }

    request(options, function(error, response, body) {
	if(!error && response.statusCode == 200) {
	   if(body=='ok') {
	       console.log('succeeded sethealth:', articleid);
	   } else { 
	       console.log('failed sethealth:', articleid);
	   }
	} else {
	   console.log('retry sethealth:', articleid);
	   setHealth(articleid, health);
	}
    });
}

function ossupload(target, source, cb)
{
     var ossClient = new OSS({
         region: oss_region,
         accessKeyId: oss_accessKeyId,
         accessKeySecret: oss_accessKeySecret,
	 bucket: oss_bucket 
     });

     co(function* () {
         var result = yield ossClient.put(target, fs.createReadStream(source));
     }).catch(function(err) {
         ossupload(target, source, cb);
         return;
     });

     co(function* () {
         var result = yield ossClient.head(target);
         var length = parseInt(result.res.headers['content-length']);
         if (length > 0) {
             console.log('succeed uploading ', source, 'size:', length);
	     cb('ok', util.format('%s/%s', oss_public_host, target));
         } else {
            ossupload(target, source, cb);
            return;
         }
     }).catch(function(err) {
         ossupload(target, source, cb);
         return;
     });
}

function scaleAndUpload(siteid, articleid, imgfile, cb)
{
  var filename = util.format('./pic/%s/%s', siteid, imgfile); 

  easyimg.info(filename).then(
     function(file) {
	var type=file['type'];
	var width=parseInt(file['width']);
	var height=parseInt(file['height']);
	var aspect_ratio = width/height;
        var dstfilename = util.format('./pic/%s/%s.thumb.%s', siteid, imgfile, type); 

        //Between 16:9 and 4:3
	if(aspect_ratio < 1.8 && aspect_ratio > 1.3 && width >= standard_width && height >= standard_height) {
	    var x = 0;
	    var y = 0;
	    var scalex = standard_width;
	    var scaley = standard_height;
	    if(aspect_ratio > standard_ratio) {
		scalex = standard_height * (width/height);
		x = Math.floor((scalex - standard_width)/2);
	    } else {
		scaley = standard_width * (height/width);
		y = Math.floor((scaley - standard_height)/2);
	    }

	    easyimg.rescrop({
		src:filename, dst:dstfilename,
		width:scalex,
		height:scaley,
		cropwidth: standard_width, cropheight: standard_height,
		x:x, y:y
	    }).then(
		function(image) {
		   ossupload(util.format('pic/%s/%s.%s', siteid, imgfile, type), dstfilename, cb);
		},
		function(err) {
		   console.log(err);
	    	   cb('ok');
		}
	    );
	} else {
	    console.log('Cannot scale image:', imgfile, 'width:', width, 'height:', height);
	    cb('ok');
	}
     }, function(err) {
	cb('ok');
     }
  );
}

function downloadImage(siteid, articleid, imgurl, cb)
{
   var md5 = crypto.createHash('md5');
   md5.update(imgurl);
   var imgfile = md5.digest('hex');

   var localfile = util.format('./pic/%s/%s', siteid, imgfile);
   var options = {
	directory: util.format('./pic/%s', siteid),
	filename: imgfile,
	timeout: 60000 
   }

   console.log(util.format('downloading image %s(imgid:%s)', imgurl, imgfile));

   download(imgurl, options, function(err) {
	if (err) {
	     if(err == '402' || err == '403' || err == '404'){
	        console.log('failed downloading ', imgurl, 'code=', err);
		setHealth(articleid, 0);
		cb('ok');
	     } else {
	        console.log('retry downloading ', imgurl,  'code=', err);
	        downloadImage(siteid, articleid, imgurl, cb);
	     }
	} else if(fs.existsSync(localfile)) {
	     var stats = fs.statSync(localfile);
	     if(stats['size']==0) {
	         downloadImage(siteid, articleid, imgurl, cb);
	     } else {
		 scaleAndUpload(siteid, articleid, imgfile, cb);
	     }

	} else {
	     downloadImage(siteid, articleid, imgurl, cb);
	}
   });
}

function processImageArray(siteid, articleid, imgarray)
{
   fs.mkdir('./pic', 0777, function(err) {
     fs.mkdir('./pic/'.concat(siteid), 0777, function(err) {
	if(imgarray.length > 0) {
	    var imgurl = imgarray.pop();
	    var cb = function(err, cdn_public_url) {
		if(err == 'ok') {
		    if(!cdn_public_url) { 
			processImageArray(siteid, articleid, imgarray);
		    } else {
			var posturl = util.format('%s/addimg?articleid=%s&imgurl=%s',
						    hunter_server_host,
						    encodeURIComponent(articleid), 
						    encodeURIComponent(cdn_public_url)
					  ); 
					
			var options = {
				url: posturl,
				timeout: 10000
			}

			request(options, function(error, response, body) {
				if(!error && response.statusCode == 200) {
				   if(body!='full') {
					processImageArray(siteid, articleid, imgarray);
				   }
				} else {
				   console.log('failed addimg articleid:', articleid, 'imgurl:', imgurl);
				}
			});
		    }
		}
	    };
	    downloadImage(siteid, articleid, imgurl, cb);
	}
     });
   });
}

function checkImage(articleid, imgurl)
{
       var options = {
	  url: imgurl,
	  timeout: 60000
       }

       request(options, function(error, response, body) {
	   if(!error) {
	       if (response.statusCode >= 300) {
	          console.log('found error image:', imgurl, 'code:', response.statusCode, 'article:', articleid); 
		  setHealth(articleid, 0);
	       }
	   } else {
	       console.log('retry checking image:', imgurl, error);
	       checkImage(articleid, imgurl);
	   }
       });
}

function parseArticle(siteid, articleid, url, title, excerpt, article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector)
{
    console.log('parsing article:', url);

    var articleWeb = Nightmare({ show: false, gotoTimeout: 60000 })
    articleWeb
        .goto(url)
        .evaluate(function(article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector) {

		function queryDomString(node, selector) {
		   if(!selector)
			return null;
		   if(selector.indexOf('/') > -1) {
			var arr = selector.split('/');
			var i=0;
			while(i < arr.length-1) {
			   if(node.querySelector(arr[i])) {
			        node = node.querySelector(arr[i]);
			        i++;
			   } else {
				return null;
			   }
			}
			return queryDomString(node, arr[i]);
		   } else if(selector.indexOf('$') > -1) {
			var arr = selector.split('$');
			if(node.querySelector(arr[0])) {
		           return node.querySelector(arr[0]).getAttribute(arr[1]);
			} else {
			   return null;
			}
		   } else if(selector.indexOf('\\') > -1) {
                        var arr = selector.split('\\');
                        var selectNode = node.querySelector(arr[0]);
                        if(selectNode) {
                           for(var i=1; i<arr.length; i++) {
                               var nodeToRemove = selectNode.querySelector(arr[i]);
			       if(nodeToRemove) {
                                  nodeToRemove.parentNode.removeChild(nodeToRemove);
			       }
                           }
                           return selectNode.innerHTML;
                        } else {
                           return null;
                        }
                   } else if (selector.indexOf('@') > -1) {
			var arr = selector.split('@');
			var key = arr[1];
			var start = parseInt(arr[2]);
			var end = parseInt(arr[3]);
			if(node.querySelector(arr[0])) {
		            var str = node.querySelector(arr[0]).innerHTML;
			    
			    var keyIndex = str.indexOf(key);
			    if(keyIndex > -1 && keyIndex+start > -1 && keyIndex+end<=str.length) {  
			        return str.slice(keyIndex+start, keyIndex+end);
			    } else {
				return null;
			    }
			} else {
			    return null;
			}
		   } else {
			var selectNode = node.querySelector(selector);
			if(selectNode) {
			   return selectNode.innerHTML;
			} else {
			   return null;
			}
		   }
		}

		function queryDomNode(node, selector) {
		   if(selector.indexOf('!') > -1) {
			var key = selector.replace('!','');
			var targetNode = node.querySelector(key);
			return targetNode;
		   } else {
			return node.querySelector(selector);
		   }
		}

		function domFilter(node, filter) {
		   //STOP node
		   if(filter.indexOf('!') > -1) {
			var stopNode = queryDomNode(node, filter);
			while(stopNode) {
			    var nodeToRemove = stopNode;
			    stopNode = stopNode.nextSibling;		
			    nodeToRemove.parentNode.removeChild(nodeToRemove);
			}
		   } else {
			var node_list = node.querySelectorAll(filter);
	 	        for (var i=0; i < node_list.length; ++i) {
	     		    node_list[i].parentNode.removeChild(node_list[i]);
	 	        }
		   }
		}

	        var result = new Object();	

		var dateTime = queryDomString(document, article_publishtime_selector);
		if(dateTime != null) {
		   result['publishtime'] = dateTime;
		}

		function processImgNode(node) {
		   var style = node.getAttribute('style');
		   if(style && (style.display=='none' || style.hidden=='hidden')) {
		       node.parentNode.removeChild(node);
		   } else {
	    	       node.removeAttribute('style');
	    	       node.removeAttribute('title');
	    	       node.removeAttribute('alt');
		   }
	        }
	 
	        function processIframeNode(node) {
		   var style = node.getAttribute('style');
		   if(style && (style.display=='none' || style.hidden=='hidden')) {
		       node.parentNode.removeChild(node);
		   } else {
	               node.removeAttribute('style');
		   }
	        }

	        function processNormalNode(node) {
		   var style = node.getAttribute('style');
		   if(style && (style.display=='none' || style.hidden=='hidden')) {
		       node.parentNode.removeChild(node);
		   } else {
		       node.removeAttribute('style');
		       node.removeAttribute('class');
		       node.removeAttribute('id');
		       node.removeAttribute('href');
		       node.removeAttribute('title');
		       node.removeAttribute('target');
		       node.removeAttribute('rel');
		       node.removeAttribute('color');
		   }
	        }

		function domWalker(node) {
			if(node.tagName == 'IMG') {
				processImgNode(node);
	    		} else if(node.tagName == 'IFRAME') {
				processIframeNode(node);
	    		} else if(node.tagName == 'DIV' || node.tagName == 'SECTION' || 
		      		node.tagName == 'H1' ||node.tagName == 'H2' || node.tagName == 'H3' ||node.tagName == 'H4' || node.tagName == 'H5' ||node.tagName == 'H6' ||
		      		node.tagName == 'HR' || node.tagName == 'BR' || 
		      		node.tagName == 'P'|| node.tagName == 'STRONG'|| 
		      		node.tagName == 'SPAN'|| node.tagName == 'A'|| node.tagName == 'EM' || node.tagName == 'FONT') {
				processNormalNode(node);
	    		}

	    		node = node.firstChild;
            		while(node) {
				domWalker(node);
	        		node = node.nextSibling;
            		}
		}

		//check article health
		if(article_body_remove_selector) {
			var remove_arr = article_body_remove_selector.split('|');
			for(var i=0; i<remove_arr.length; i++) {
			    var target = queryDomNode(document, remove_arr[i]);
			    if(target != null) {
				result['health'] = 0;
				return result;
			    }
			}
		}
	
		var content = queryDomNode(document,article_body_selector); 
		if(content == null) {
			return result;
		}
		   
		domFilter(content, 'script');
		domFilter(content, 'noscript');
		if(article_body_filter != null) {
		    	var filter_arr = article_body_filter.split('|');
			for(var i=0; i<filter_arr.length; i++) {
			   domFilter(content, filter_arr[i]);			    
			}
		}

		domWalker(content);
		result['content'] = content.outerHTML;
		
	 	var imgnodearray = content.querySelectorAll('img'); 
		var imgarray = []; 
	        for (var i=0; i<imgnodearray.length; ++i) {
		    var src = imgnodearray[i].getAttribute('src');
		    if(src) {
			imgarray.push(src);
		    }
		}
		result['imgarray'] = imgarray;

		return result;

	}, article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector)
        .end()
        .then(function(result) {
	
		if(result['publishtime'] && result['content']) {

		    var target = util.format('%s/%s.html', siteid, articleid);
		    var buffer = result['content'];
		    
		    var stripBuffer = filterHTML(buffer); 
		    var word_arr = nodejieba.extract(stripBuffer, topN);
		    var topics = '';
		    for (var i=0; i<word_arr.length; i++) {
			if(i>0)
			    topics += '|';
			topics += word_arr[i]['word'];
		    }
		    console.log(topics);

		    ossuploadBuffer(target, buffer);

		    var publish_unix_time = moment(result['publishtime'], article_publishtime_format).unix();
		    var contenturl = util.format('%s/%s/%s.html', oss_public_host, siteid, articleid);

		    var imgarray = result['imgarray'];
		    var imgurl = '';
		    for (var i=0; i<imgarray.length; i++) {
			if(i>0)
			    imgurl += '|';
			imgurl += imgarray[i];
		    }

		    var posturl = util.format('%s/postarticle?articleid=%s&siteid=%s&url=%s&title=%s&excerpt=%s&publishtime=%s&contenturl=%s&imgurl=%s&topics=%s',
					hunter_server_host,
					encodeURIComponent(articleid), 
					encodeURIComponent(siteid), 
					encodeURIComponent(url), 
					encodeURIComponent(title),
					excerpt?encodeURIComponent(excerpt):'',
					encodeURIComponent(publish_unix_time),
					encodeURIComponent(contenturl),
					encodeURIComponent(imgurl),
					encodeURIComponent(topics)
			); 
		
		    var options = {
			url: posturl,
			timeout: 5000
		    }

		    request(options, function(error, response, body) {
			if(!error && response.statusCode == 200) {
			   if(body=='ok') {
			       console.log('succeeded post article:', title, url);
			
			       //Check, scale and crop image
			       processImageArray(siteid, articleid, imgarray);	
				
			   } else { 
			       console.log('failed post article:', title, url, body);
			   }
			}
		    });
		} else {
		    console.log('failed parsing article:', title, url);
		}
        })
        .catch(function(error) {
              console.log('error fetching:', url, 'title:', title, 'error:', error);
        });
}

function queryAndPostArticle(siteid, articleid, url, title, excerpt, article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector)
{
    var geturl = util.format('%s/getarticle?articleid=%s',hunter_server_host, articleid); 
    var options = {
        url: geturl,
        timeout: 5000
    }

    request(options, function(error, response, body) {
	if(!error && response.statusCode == 200) {
	   if(body == "Not found") {	
	      parseArticle(siteid, articleid, url, title, excerpt, article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector);
	   }
        } else {
           console.log(url, error, body);
	}
    });

}

function websiteUpdate(siteid)
{
    var url = util.format('%s/siteupdate?siteid=%s', hunter_server_host, siteid); 
    var options = {
        url: url,
        timeout: 5000
    }

    request(options, function(error, response, body) {
	if(!error && response.statusCode == 200) {
	    if(body=='ok') {
               console.log('succeeded update website: %s', siteid);
	    } else { 
               console.log('failed update website: %s', siteid, error);
	    }
        } else {
            console.log(url, error, body);
	}
    });
}


//Main program
function go_crawl()
{
     var url = util.format('%s/getatomicsite', hunter_server_host);
     var options = {
        url: url,
        timeout: 5000
     }

     request(options, function(error, response, body) {
	 if(!error && response.statusCode == 200) {
	     site_list = JSON.parse(body.toString()); 
	     //console.log(site_list);

	     for(var i=0; i<site_list.length; i++) {
		  var host_array = site_list[i]['hosturl'].split('|');
		  for(var j=0; j<host_array.length; j++) {
			var hosturl = host_array[j];
		        queryWebSite(site_list[i]['siteid'], hosturl, 
				site_list[i]['feed_block_selector'], site_list[i]['article_url_selector'], site_list[i]['article_title_selector'], site_list[i]['article_excerpt_selector'],
				site_list[i]['article_publishtime_selector'], site_list[i]['article_publishtime_format'], site_list[i]['article_body_selector'], site_list[i]['article_body_filter'], site_list[i]['article_body_remove_selector']
			);
		  }
	     }
	 } else {
	     console.log(error);
	     go_crawl();
	 }
     });
}

go_crawl();

