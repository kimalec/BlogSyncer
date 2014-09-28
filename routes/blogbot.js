/**
 *
 * Created by aleckim on 2014. 8. 13..
 */

var request = require('request');
var blogdb = require('../models/blogdb');
var postdb = require('../models/postdb');
var historydb = require('../models/historydb');
var groupdb = require('../models/groupdb');

var log = require('winston');

function BlogBot() {
}

BlogBot.users = [];
/*
    [
        { "user":object, "blogdb":blogdb, "postdb":postdb, "historydb":historydb },
        { "user":object, "blogdb":blogdb, "postdb":postdb, "historydb":historydb },
    ]
 */

BlogBot.findBlogDbByUser = function(user) {
    for (var i=0; i<this.users.length; i++) {
        if (this.users[i].user.id === user.id) {
            return this.users[i].blogDb;
        }
    }
    log.debug('users='+this.users.length);
    log.debug('Fail to find user '+user.id);
};

BlogBot.findPostDbByUser = function(user) {
    for (var i=0; i<this.users.length; i++) {
        if (this.users[i].user.id === user.id) {
            return this.users[i].postDb;
        }
    }
};

BlogBot.findHistoryDbByUser = function(user) {
    for (var i=0; i<this.users.length; i++) {
        if (this.users[i].user.id === user.id) {
            return this.users[i].historyDb;
        }
    }
};

BlogBot.findGroupDbByUser = function(user) {
    for (var i=0; i<this.users.length; i++) {
        if (this.users[i].user.id === user.id) {
            return this.users[i].groupDb;
        }
    }

    log.error("Fail to find group db by user");
};

BlogBot.send_post_to_blogs = function (user, recv_posts) {

    if (recv_posts === undefined)  {
        log.debug("Fail to get recv_posts");
        return;
    }

    var groupDb = BlogBot.findGroupDbByUser(user);
    var blog_id = recv_posts.blog_id;
    var provider_name = recv_posts.provider_name;
    var post = recv_posts.posts[0];
    var groups = groupDb.findGroupByBlogInfo(provider_name, blog_id);

    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        for (var j = 0; j < group.length; j++) {
            var targetBlog = group[j].blog;
            var provider = group[j].provider;
            if (targetBlog.blog_id == blog_id && provider.providerName == provider_name) {
                log.debug('send_post_to_blogs: skip current blog id='+blog_id+' provider='+provider_name);
                //skip current blog
            }
            else {
                log.info('send_post_to_blogs: post id='+post.id+' to provider='+provider.providerName+
                                ' blog='+targetBlog.blog_id);
                BlogBot.request_post_content(user, post, provider.providerName, targetBlog.blog_id,
                        BlogBot.add_postinfo_to_db);
            }
        }
    }
};

BlogBot.push_posts_to_blogs = function(user, recv_posts) {

    if (recv_posts === undefined)  {
        log.debug("Fail to get recv_posts");
        return;
    }

    var postDb = BlogBot.findPostDbByUser(user);

//TODO: if post count over max it need to extra update - aleckim
    for(var i=0; i<recv_posts.posts.length;i++) {
        var new_post = recv_posts.posts[i];
        if (postDb.find_post_by_post_id_of_blog(recv_posts.provider_name, recv_posts.blog_id, new_post.id)) {
            log.debug('this post was already saved - provider ' + recv_posts.provider_name + ' blog ' +
                            recv_posts.blog_id + ' post ' + new_post.id);
            continue;
        }

        BlogBot._makeTitle(new_post);
        postDb.add_post(recv_posts.provider_name, recv_posts.blog_id, new_post);
        BlogBot.request_get_posts(user, recv_posts.provider_name, recv_posts.blog_id, {"post_id":new_post.id},
            BlogBot.send_post_to_blogs);
        //push post to others blog and add_postinfo
    }
};

BlogBot.getAndPush = function(user) {
    log.debug("start get blog of user" + user.id);
    var blogDb = BlogBot.findBlogDbByUser(user);
    var postDb = BlogBot.findPostDbByUser(user);
    var sites = blogDb.sites;
    var after = postDb.lastUpdateTime.toISOString();
    log.debug(after);

    for (var i = 0; i < sites.length; i++) {
        for (var j = 0; j < sites[i].blogs.length; j++) {
            BlogBot.request_get_posts(user, sites[i].provider.providerName, sites[i].blogs[j].blog_id,
                            {"after":after}, BlogBot.push_posts_to_blogs);
        }
    }
    postDb.lastUpdateTime = new Date();
};

BlogBot.task = function() {
    log.debug('Run BlogBot Task');
    for (var i=0; i<this.users.length; i++)  {
        var user = this.users[i].user;
        BlogBot.getAndPush(user);
    }
//    var post = {};
//    post.title = "justwapps test";
//    post.content = "it is for test of justwapps";
//    post.tags = "justwapps, api";
//    post.categories ="development";
//    BlogBot.request_post_content(this.users[0].user, post, "tistory", "aleckim", BlogBot.add_postinfo_to_db);
};

BlogBot.start = function (user) {
    log.debug("start BlogBot");
    var userInfo = {};
    userInfo.user = user;
    var sites = [];
    userInfo.blogDb = new blogdb(sites);
    log.debug(userInfo.blogDb);
    var posts = [];
    userInfo.postDb = new postdb(posts);
    userInfo.postDb.lastUpdateTime = new Date();
    var histories = [];
    userInfo.historyDb = new historydb(histories);
    this.users.push(userInfo);
    var groups = [];
    userInfo.groupDb = new groupdb(groups);
    this.users.push(userInfo);
    return;
};

BlogBot.stop = function (user) {
    log.debug("stop get blog of user " + user.id);
    return;
};

BlogBot.add_blogs_to_db = function (user, recv_blogs) {

    /*
     { "provider":object, "blogs":
                            [ {"blog_id":12, "blog_title":"wzdfac", "blog_url":"wzdfac.iptime.net"},
                              {"blog_id":12, "blog_title":"wzdfac", "blog_url":"wzdfac.iptime.net"} ] },
     */

    if (recv_blogs === undefined) {
        log.debug("Fail to get recv_blogs");
        return;
    }

    var provider = recv_blogs.provider;
    var blogs = recv_blogs.blogs;
    var blogDb = BlogBot.findBlogDbByUser(user);

    if (blogDb === undefined) {
        log.debug('add_blogs_to_db : Fail to find blogDb of user='+user.id);
        return;
    }

    //log.debug(provider);
    var site = blogDb.findSiteByProvider(provider.providerName);

    if (site) {
        for (var i = 0; i<blogs.length; i++) {
            var blog = blogDb.find_blog_by_blog_id(site, blogs[i].blog_id);
            if (blog) {
                continue;
            }
            else {
                site.blogs.push(blogs[i]);
                BlogBot.request_get_post_count(user, site.provider.providerName, blogs[i].blog_id,
                                BlogBot.add_posts_from_new_blog);
            }
        }
    }
    else {
        site = blogDb.addProvider(provider, blogs);
        for (var i = 0; i < site.blogs.length; i++) {
            BlogBot.request_get_post_count(user, site.provider.providerName, site.blogs[i].blog_id,
                            BlogBot.add_posts_from_new_blog);
        }
    }

    log.debug('site providerName=' + site.provider.providerName);
//    for (var j = 0; j < site.blogs.length; j++) {
//        log.debug(site.blogs[j]);
//    }

    return;
};

BlogBot.findOrCreate = function (user) {
    log.debug("find or create blog db of user " + user.id);

    for (var i = 0; i < user.providers.length; i++)
    {
        var p = user.providers[i];
        BlogBot.request_get_bloglist(user, p.providerName, p.providerId, BlogBot.add_blogs_to_db);
    }

    return;
};

BlogBot.getSites = function (user) {
    log.debug('BlogBot.getSites');
    return BlogBot.findBlogDbByUser(user);
};

BlogBot.addGroup = function(user, group) {
    var groupDb = BlogBot.findGroupDbByUser(user);
    groupDb.groups.push(group);
};

BlogBot.setGroups = function(user, groups) {
    var groupDb = BlogBot.findGroupDbByUser(user);
    groupDb.groups = groups;
};

BlogBot.getGroups = function(user) {
    var groupDb = BlogBot.findGroupDbByUser(user);
    return groupDb.groups;
};

BlogBot.add_postinfo_to_db = function (user, recv_posts) {
    if (recv_posts == undefined) {
        log.error("Fail to get recv_posts");
        return;
    }

    var postDb = BlogBot.findPostDbByUser(user);

    if (recv_posts.posts == undefined) {
        log.error("BlogBot.add_postinfo_to_db: Broken posts");
        return;
    }

    if (recv_posts.posts[0].title == undefined) {
        log.error("Fail to find title !!");
        //TODO content 및 다른 것으로 찾아서 넣는다.
        return;
    }

    var post = postDb.find_post_by_title(recv_posts.posts[0].title);

    if (post == undefined) {
        log.error("Fail to found post by title"+recv_posts.posts[0].title);
        return;
    }

    postDb.add_postinfo(post, recv_posts.provider_name, recv_posts.blog_id, recv_posts.posts[0]);
    log.info("postDb.add_postinfo !!! ");
};

BlogBot.add_posts_to_db = function(user, recv_posts) {
    if (recv_posts === undefined) {
        log.debug("Fail to get recv_posts");
        return;
    }

    log.debug('BlogBot.add_posts_to_db');

    var postDb = BlogBot.findPostDbByUser(user);

    //TODO: change from title to id
    for(var i = 0; i<recv_posts.posts.length;i++) {
        if (recv_posts.posts[i].title !== undefined) {
            var post = postDb.find_post_by_title(recv_posts.posts[i].title);

            //log.debug(recv_posts.provider_name, recv_posts.blog_id, recv_posts.posts[i]);
            if (post) {
                postDb.add_postinfo(post, recv_posts.provider_name, recv_posts.blog_id, recv_posts.posts[i]);
                continue;
            }
        }

        postDb.add_post(recv_posts.provider_name, recv_posts.blog_id, recv_posts.posts[i]);
    }

    //postDb.saveFile();

    return;
};

BlogBot.recursiveGetPosts = function(user, provider_name, blog_id, options, callback) {
    BlogBot.request_get_posts(user, provider_name, blog_id, options, function (user, recv_posts) {

        log.debug("recursiveGetPosts: recv posts");

        if (recv_posts === undefined) {
            log.debug("Fail to get recv_posts");
            return;
        }

        callback(user, recv_posts);
        if (recv_posts.posts.length != 0) {
            var index = recv_posts.posts.length-1;
            var new_opts = {};
            new_opts.offset = recv_posts.posts[index].id;
            log.debug("recursiveGetPosts: get posts");
            BlogBot.recursiveGetPosts(user, provider_name, blog_id, new_opts, callback);
        }
        else {
            log.debug("Stop recursive call functions");
        }
    });
};

BlogBot.add_posts_from_new_blog = function(user, recv_post_count) {

    log.debug('BlogBot.add_posts_from_new_blog');

    if (recv_post_count === undefined) {
        log.debug("Fail to get recv_post_count");
        return;
    }

    var provider_name = recv_post_count.provider_name;
    var blog_id =  recv_post_count.blog_id;
    var post_count = recv_post_count.post_count;

    //how many posts get per 1 time.
    if (post_count > 0) {
        for (var i = 0; i < post_count; i += 20) {
            var offset = i + '-20';
            BlogBot.request_get_posts(user, provider_name, blog_id, {"offset": offset}, BlogBot.add_posts_to_db);
        }
    }
    else if (post_count < 0) {
        log.debug("post_count didn't supported");
        var options = {};
        BlogBot.recursiveGetPosts(user, provider_name, blog_id, options, BlogBot.add_posts_to_db);
    }
    //else for nothing

    return;
};

function _checkError(err, response, body) {
    if (err) {
        log.debug(err);
        return err;
    }
    if (response.statusCode >= 400) {
        var err = body.meta ? body.meta.msg : body.error;
        var errStr = 'blogbot API error: ' + response.statusCode + ' ' + err;
        log.error(errStr);
        return new Error(errStr);
    }
};

BlogBot.request_get_bloglist = function(user, provider_name, provider_id, callback) {
    var url = "http://www.justwapps.com/" + provider_name + "/bot_bloglist";
    url += "?";
    url += "providerid=" + provider_id;
    url += "&";

    url += "userid=" + user.id;

    log.debug("url=" + url);
    request.get(url, function (err, response, body) {
        var hasError = _checkError(err, response, body);

        if (hasError !== undefined) {
            callback(hasError);
            return;
        }

        //log.debug(body);

        var recvBlogs = JSON.parse(body);

        callback(user, recvBlogs);
    });

    return;
};

BlogBot.request_get_post_count = function(user, provider_name, blog_id, callback) {
    var url = "http://www.justwapps.com/"+provider_name + "/bot_post_count/";
    url += blog_id;
    url += "?";
    url += "userid=" + user.id;

    log.debug("url="+url);
    request.get(url, function (err, response, body) {
        var hasError = _checkError(err, response, body);
        if (hasError !== undefined) {
            callback(hasError);
            return;
        }

        //log.debug(body);

        var recv_post_count = JSON.parse(body);

        callback(user, recv_post_count);
    });

    return;
};

BlogBot.request_get_posts = function(user, provider_name, blog_id, options, callback) {
    var url = "http://www.justwapps.com/"+provider_name + "/bot_posts/";
    url += blog_id;

    if (options.post_id) {
        url += "/" + options.post_id;
    }

    url += "?";

    if (options.after) {
        url += "after=" + options.after;
        url += "&";
    }

    if (options.offset) {
        url += "offset="+options.offset;
        url += "&";
    }

    url += "userid=" + user.id;

    log.debug(url);
    request.get(url, function (err, response, body) {
        var hasError = _checkError(err, response, body);
        if (hasError !== undefined) {
            callback(hasError);
            return;
        }

        //log.debug(body);
        var recv_posts = JSON.parse(body);
        callback(user, recv_posts);
    });

    return;
};

BlogBot.getHistorys = function (socket, user) {

    var historyDb = BlogBot.findHistoryDbByUser(user);

    if (historyDb == undefined) {
        log.error('Fail to find historyDb of userId='+user.id);
        socket.emit('histories', {"histories":[]});
        return;
    }

    log.info('histories length='+historyDb.histories.length);
    socket.emit('histories', {"histories":historyDb.histories});
};

BlogBot.addHistory = function(user, srcPost, postStatus, dstPost) {
    var historyDb = BlogBot.findHistoryDbByUser(user);
    log.debug('BlogBot.addHistory : userId='+ user.id);
    historyDb.addHistory(srcPost, postStatus, dstPost);
};

BlogBot._makeTitle = function (post) {
     if (post.content !== undefined && post.content.length != 0) {

        var indexNewLine = post.content.indexOf("\n");

        if (indexNewLine < 30) {
            post.title = post.content.substr(0, indexNewLine);
            return;
        }

        if (post.content.length < 30) {
            post.title = post.content;
            return;
        }

        post.title = post.content.substr(0,27);
        return;
    }

    if (post.url !== undefined) {
        post.title = post.url;
        return;
    }

    log.debug("Fail to make title!!!");
};

BlogBot.request_post_content = function (user, post, provider_name, blog_id, callback) {
    var url = "http://www.justwapps.com/"+provider_name + "/bot_posts";
    url += "/new";
    url += "/"+encodeURIComponent(blog_id);
    url += "?";
    url += "userid=" + user.id;

    //send_data title, content, tags, categories
    if (post.title == undefined) {
        BlogBot._makeTitle(post);
    }

    var opt = { form: post };

    log.debug('post='+url);
    request.post(url, opt, function (err, response, body) {
        var hasError = _checkError(err, response, body);
        if (hasError !== undefined) {
            callback(hasError);
            return;
        }

        //add post info
        //log.debug(body);
        var recv_posts = JSON.parse(body);
        callback(user, recv_posts);

        if (recv_posts.posts == undefined) {
            BlogBot.addHistory(user, post, response.statusCode);
        }
        else {
            BlogBot.addHistory(user, post, response.statusCode, recv_posts.posts[0]);
        }
        //add success to history
    });

    return;
};

/*****************************************************/
BlogBot.getPosts = function (socket, user) {

    var postDb = BlogBot.findPostDbByUser(user);

    log.debug('BlogBot.getPosts : userid='+ user.id);
    if (postDb === undefined) {
        log.debug('Fail to find postdb of user='+user.id);
        socket.emit('posts', {"post_db":[]});
        return;
    }

    //var userID = this.user.id;
    //log.debug(this.user);
//    var p = this.user.providers[0];
//    var url = "http://www.justwapps.com/blog/blogCollectFeedback/posts";
//    url = url + "?userid=" + this.user.id;
//    url = url + "&providerid=" + p.providerId;
//    log.debug("url="+url);
//    request.get(url, function (err, response, body) {
//      var hasError = _checkError(err, response, body);
//      if (hasError !== undefined) {
//        callback(hasError);
//        return;
//      }
//        log.debug("[BlogBot.getPosts]" + body);
//        var jsonData = JSON.parse(body);
//        log.debug(jsonData);
//        socket.emit('posts', jsonData);
//    });

    log.debug('posts length='+postDb.posts.length);
    socket.emit('posts', {"post_db":postDb.posts});

    return;
};

BlogBot.getComments = function (socket, user, postID) {
    log.debug('BlogBot.getComments : '+ user.id);
    var userID = user.id;
    //log.debug(user);
    var p = user.providers[0];

//    var url = "http://www.justwapps.com/blog/blogCollectFeedback/posts/"+postID+"/comments";
//    url = url + "?userid=" + userId;
//    url = url + "&providerid=" + p.providerId;
//    log.debug("url="+url);
//    request.get(url, function (err, response, data) {
//        if(err) {
//            log.debug("Cannot get getComments : " + err);
//        }
//        log.debug("[BlogBot.getComments]" + data);
//        var jsonData = JSON.parse(data);
//        log.debug(jsonData);
//        socket.emit('comments', jsonData);
//    });

    return;
};

BlogBot.get_reply_count = function (socket, user, post_id) {
    var postDb = BlogBot.findPostDbByUser(user);
    var post = postDb.find_post_by_id(post_id);

    for (var i=0; i<post.infos.length; i++) {

        BlogBot.request_get_posts(user, post.infos[i].provider_name, post.infos[i].blog_id,
                        {"post_id":post.infos[i].post_id}, function (user, recv_posts) {
            var recv_post = recv_posts.posts[0];
            var send_data = {};
            send_data.providerName = recv_posts.provider_name;
            send_data.blogID = recv_posts.blog_id;
            send_data.postID = recv_post.id;
            send_data.replies = recv_post.replies;
            //log.debug(send_data);
            socket.emit('reply_count', send_data);
        });
    }
    return;
};

module.exports = BlogBot;

