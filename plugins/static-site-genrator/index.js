/*!
 * static-site-genrator
 */

"use strict";

/*!
 * Module dependencies
 */
var contentstack = require('contentstack-express'),
    stack = contentstack.Stack(),
    path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    request = require('request'),
    gulp = require('gulp'),
    sortBy = require('lodash').sortBy,
    async = require('async');

var gulptask = require("./gulp.js");
var config = contentstack.config,
    environment = config._config.environment,
    temppath = config._config.path.templates,
    basePath = config._config.path.base;

module.exports = function StaticSiteGenrator() {
    var options = StaticSiteGenrator.options;
    var expressApp;
    var staticFolderPath;
    var staticFolderName;
    var ignoreurls = [];

    //checking plugin options here
    (options.staticfoldername) ? staticFolderName = options.staticfoldername : staticFolderName = "static";
    (options.ignoreurls) ? ignoreurls = options.ignoreurls : ignoreurls = [];
    (options.staticfolderpath) ? ( (fs.existsSync(options.staticfolderpath)) ? staticFolderPath = options.staticfolderpath : staticFolderPath = basePath) : staticFolderPath = basePath;

    //Gulp Activity Start
    gulptask.fileChanges(staticFolderPath,staticFolderName,temppath)

    //plugin start here

    StaticSiteGenrator.serverExtends = function (app) {
        expressApp = app;
        var locals = config._config.languages;
        var alllocals = locals.map(function (locale, instanceIndex) {
            app.use(locale.relative_url_prefix, contentstack.static(path.join(staticFolderPath, staticFolderName, locale.code, 'home'), {
                setHeaders: function (res, path, stat) {
                    res.set('x-static', "serving static file");
                }
            }))
            app.use(locale.relative_url_prefix, contentstack.static(path.join(staticFolderPath, staticFolderName, locale.code), {
                setHeaders: function (res, path, stat) {
                    res.set('x-static', "serving static file");
                }
            }))
        })

        gulp.task('restart', function () {
            var languages = config._config.languages;
            var alllanguages = languages.map(function (language, instanceIndex) {
                var deferred = Q.defer();
                var code = language["code"];
                var query = stack.ContentType('_routes').Query().language(code).toJSON().find();
                query.then(
                    function (data) {
                        if (data.length > 0) {
                            var filedata = data[0];
                            var allfiledata = filedata.map(function (filecontent, instanceIndex) {
                                var deferred1 = Q.defer();
                                var type = filecontent["content_type"]["uid"]
                                var metaid = filecontent["entry"]["uid"]
                                var query1 = stack.ContentType(type).Query().language(code).Entry(metaid).toJSON().find();
                                query1.then(
                                    function (result) {
                                        var mainurl = result.url;
                                        if ((ignoreurls.indexOf(mainurl)) == -1) {
                                            if (mainurl == "/")
                                                mainurl = "/home"
                                            var temp = path.join(temppath, "pages", type, "index.html")
                                            app.render(temp, {entry: result}, function (err, html) {
                                                if (err) {
                                                    console.log("render Error::::", err)
                                                    deferred1.resolve();
                                                } else {
                                                    async.series([
                                                        function (callback) {
                                                            staticFileCreate(mainurl, code, html, callback)
                                                        },
                                                        function (callback) {
                                                            createMapping(type, code+mainurl, callback)
                                                        }
                                                    ], function (err, results) {
                                                        deferred1.resolve();
                                                    });
                                                }
                                            })
                                        }else{
                                            console.log("Url is ignored",mainurl)
                                            deferred1.resolve();
                                        }

                                    }, function (error) {
                                        console.log("Something wrong to fetch data")
                                        deferred1.resolve();
                                    })
                                return deferred1.promise
                            })
                            return Q.all(allfiledata)
                                .then(function () {
                                    deferred.resolve();
                                })
                        } else {
                            deferred.resolve();
                        }
                    }, function (error) {
                        console.log("Something wrong for locale:", code + "due to ::", error)
                        deferred.resolve();
                    }
                )
                return deferred.promise
            })
            return Q.all(alllanguages)
                .then(function () {
                    console.log("All pages rebuid properly")
                })
        })
        setTimeout(function () {
            gulp.start('restart');
        }, 500)

    };

    StaticSiteGenrator.beforePublish = function (data, next) {
        if (data.content_type) {
            if (data.content_type.options.is_page) {
                if ((ignoreurls.indexOf(data.entry.url)) == -1) {
                    var lang = data.language,
                        content_type_uid = data.content_type.uid,
                        template = path.join(temppath, "pages", data.content_type.uid, "index.html"),
                        content = data.entry,
                        mainurl = data.entry.url;
                    if (mainurl == "/")
                        mainurl = "/home"
                    if (fs.existsSync(template)) {
                        expressApp.render(template, {entry: content}, function (err, html) {
                            if (err) {
                                console.log('something wrong', err)
                                next()
                            } else {
                                async.series([
                                    function (callback) {
                                        staticFileCreate(mainurl, lang.code, html, callback)
                                    },function (callback) {
                                        createMapping(content_type_uid, lang.code+mainurl, callback)
                                    }
                                ], function (err, results) {
                                    next()
                                });
                            }
                        })
                    } else {
                        console.log("Template is not present for url", mainurl)
                        next()
                    }
                } else {
                    console.log("This url is ignored");
                    next()
                }
            } else {
                console.log("Content Block Publishing")
                next()
            }
        } else {
            console.log("Asset Publishing");
            next()
        }
    };

    function staticFileCreate(mainurl,code,html,callback1){
        var url = mainurl.split("/");
        if (!fs.existsSync(path.join(staticFolderPath, staticFolderName)))
            fs.mkdirSync(path.join(staticFolderPath, staticFolderName));
        if (!fs.existsSync(path.join(staticFolderPath, staticFolderName, code)))
            fs.mkdirSync(path.join(staticFolderPath, staticFolderName, code));
        if (url.length == 2) {
            if (!fs.existsSync(path.join(staticFolderPath, staticFolderName, code, url[1])))
                fs.mkdirSync(path.join(staticFolderPath, staticFolderName, code, url[1]));
            fs.writeFileSync(path.join(staticFolderPath, staticFolderName, code, url[1], 'index.html'), html, "utf-8");
            console.log("Static File Created Sucessfully");
            callback1(null,"sucess")
        }else{
            var mainpath = path.join(staticFolderPath, staticFolderName, code);
            url.splice(0, 1);
            var folders = url.map(function (folderName, instanceIndex) {
                var deferred2 = Q.defer();
                mainpath = path.join(mainpath, folderName);
                if (!fs.existsSync(mainpath))
                    fs.mkdirSync(mainpath);
                deferred2.resolve();
                return deferred2.promise
            })
            return Q.all(folders)
                .then(function () {
                    console.log("Static File Created Sucessfully");
                    fs.writeFileSync(path.join(mainpath, 'index.html'), html, "utf-8");
                    callback1(null,"sucess")
                })
        }
    }



    //This function is only for matain the records of all urls
    function createMapping(content_type_uid, pageURL, callback) {
        try {
            var mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapping.json'), 'utf8'));
            if (mapping[content_type_uid]) {
                if (pageURL) {
                    var urls = mapping[content_type_uid];
                    if ((urls.indexOf(pageURL)) == -1) {
                        urls.push(pageURL)
                    }
                    mapping[content_type_uid] = urls
                    fs.writeFileSync(path.join(__dirname, 'mapping.json'), JSON.stringify(mapping, null, 4));
                    callback(null, "sucess")
                }
            } else {
                if (pageURL) {
                    var urls = [];
                    urls.push(pageURL);
                    mapping[content_type_uid] = urls;
                    fs.writeFileSync(path.join(__dirname, 'mapping.json'), JSON.stringify(mapping, null, 4))
                    callback(null, "sucess")
                }
            }
        } catch (e) {
            if (pageURL) {
                var data1 = {};
                var myarray1 = [];
                myarray1.push(pageURL);
                data1[content_type_uid] = myarray1;
                fs.writeFileSync(path.join(__dirname, 'mapping.json'), JSON.stringify(data1, null, 4));
                callback(null, "sucess")
            }
        }

    }

    StaticSiteGenrator.beforeUnpublish = function (data, next) {
        if (data.content_type) {
            if (data.content_type.options.is_page) {
                if ((ignoreurls.indexOf(data.entry.url)) == -1) {
                    var lang = data.language,
                        mainurl = data.entry.url;
                    if (mainurl == "/")
                        mainurl = "/home"
                    if (fs.existsSync(path.join(staticFolderPath, staticFolderName, lang.code, mainurl, 'index.html')))
                        fs.unlinkSync(path.join(staticFolderPath, staticFolderName, lang.code, mainurl, 'index.html'));
                    next();
                }
            } else {
                console.log("Content Block unpublish")
                deleteFolderRecursive(path.join(staticFolderPath, staticFolderName, lang.code))
                next()
            }
        } else {
            console.log("Asset unpublish")
            next()
        }
    };

    var deleteFolderRecursive = function (dirPath) {
        if (fs.existsSync(dirPath)) {
            var files = fs.readdirSync(dirPath);
            var allfiles = files.map(function (file, instanceIndex) {
                var deferred = Q.defer();
                var curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                    if ((fs.readdirSync(curPath)).length == 0) {
                        fs.rmdirSync(curPath)
                        deferred.resolve();
                    } else {
                        deleteFolderRecursive(curPath);
                        deferred.resolve();
                    }
                } else { // delete file
                    fs.unlinkSync(curPath);
                    deferred.resolve();
                }
                return deferred.promise
            })

            return Q.all(allfiles)
                .then(function () {
                    fs.rmdirSync(dirPath);
                })

        }
    };
};