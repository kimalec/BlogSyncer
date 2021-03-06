/**
 * Created by aleckim on 14. 11. 15..
 */

'use strict';

var assert  = require('assert');
var Post = require('../models/postdb');
var tD = require('./test_data');
if (!global.log) {
    global.log = require('winston');
}

var testPostInfo = tD.testPostInfo;

describe('postDb', function () {
    describe('Function', function () {
        var postDb;
        it('create postDb', function () {
            postDb = new Post();
            assert.notEqual(typeof postDb, "undefined", "Fail to create postDb");
        });
        it('add postDb', function () {
            postDb.posts.push(testPostInfo);
            assert.equal(postDb.posts[0].title, testPostInfo.title, "Fail to add postdb");
        });
        it('add post info', function () {
            var newPost;
            newPost = {};
            newPost.id = "1234";
            newPost.url = "www.fac.ttt";
            newPost.modified = new Date();
            newPost.categories = ["ddd", "xxxx"];
            newPost.tags = ["zxc", "nbv"];
            postDb.addPostInfo(postDb.posts[0], "testProvider", "testBlogId", newPost);
            assert.equal(postDb.posts[0].infos[1].post_id, newPost.id, "Fail to add post info");
        });
        it('find post by title', function () {
            var post;
            post = postDb.findPostByTitle(testPostInfo.title);
            assert.equal(post.title, testPostInfo.title, "Fail to find post by title");
        });
        it('find post by post id of blog', function () {
            var found;
            found = postDb.isPostByPostIdOfBlog(testPostInfo.infos[0].provider_name,
                        testPostInfo.infos[0].blog_id, testPostInfo.infos[0].post_id);
            assert.equal(found, true, "Fail to find post by post id of blog");
        });
        it('add post', function () {
            var newPost;
            var retPost;

            newPost = {};
            newPost.title = "test add post";
            newPost.type = "text";
            newPost.categories = ["dddd", "ememe"];
            newPost.tags = ["song", "dance"];
            newPost.id = "797979";
            newPost.url = "xxxx.9797.com";
            newPost.modified = new Date();
            retPost = postDb.addPost("newProvider", "328422", newPost);
            assert.equal(retPost.title, newPost.title, "Fail to add post");
        });
        it('get info from postInfo', function () {

            var postInfo = postDb.findPostByTitle(testPostInfo.title);
            var info = postDb.getInfoFromPostInfo(postInfo, testPostInfo.infos[0].provider_name,
                        testPostInfo.infos[0].blog_id);
            assert.equal(info.url, testPostInfo.infos[0].url, "Fail to match url");
        });
    });
});


