/*!
 * static-site-genrator
 */

 "use strict";

/*!
 * Module dependencies
 */
var contentstack =  require('contentstack-express'),
    path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    gulp = require('gulp'),
    async = require('async');

var gulptask = require("./gulp.js");
var config = contentstack.config,
    environment = config._config.environment,
    temppath = config._config.path.templates,
    basePath = config._config.path.base;
console.log(temppath)
module.exports = function StaticSiteGenrator() {
    var options = StaticSiteGenrator.options;
    var expressApp;
    var staticFolderPath;
    var staticFolderName;
    var ignoreurls = [];

    //checking plugin options here
    if (options.staticfoldername)
        staticFolderName = options.staticfoldername;
     else
        staticFolderName = "static";

    if (options.ignoreurls)
        ignoreurls = options.ignoreurls

    if (options.staticfolderpath) {
        if (fs.existsSync(options.staticfolderpath))
            staticFolderPath = options.staticfolderpath;
         else
            staticFolderPath = basePath;

    } else {
        staticFolderPath = basePath;
    }

    //Gulp Activity Start
    //gulptask.fileChanges(staticFolderPath,staticFolderName,temppath)

    //plugin start here
    StaticSiteGenrator.templateExtends = function(engine,app) {
        gulptask.restartAPP(app,temppath,staticFolderPath,staticFolderName)
   };

   StaticSiteGenrator.serverExtends = function(app) {
       expressApp = app;
       //gulptask.restartAPP(app,temppath,staticFolderPath,staticFolderName)
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
                   if(mainurl=="/")
                    mainurl="/home"
                   if (fs.existsSync(template)) {
                       expressApp.render(template, {entry: content}, function (err, html) {
                           if(err){
                               console.log('something wrong', err)
                               next()
                           }else{
                               var url = mainurl.split("/");
                               if (!fs.existsSync(path.join(staticFolderPath, staticFolderName)))
                                   fs.mkdirSync(path.join(staticFolderPath, staticFolderName));
                               if (!fs.existsSync(path.join(staticFolderPath, staticFolderName, lang.code)))
                                   fs.mkdirSync(path.join(staticFolderPath, staticFolderName, lang.code));
                               if (url.length == 2) {
                                   if (!fs.existsSync(path.join(staticFolderPath, staticFolderName, lang.code, url[1])))
                                       fs.mkdirSync(path.join(staticFolderPath, staticFolderName, lang.code, url[1]));
                                   fs.writeFileSync(path.join(staticFolderPath, staticFolderName, lang.code, url[1], 'index.html'), html, "utf-8");
                                   console.log("Static File Created Sucessfully");
                                   async.series([
                                       function (callback) {
                                           createMapping(content_type_uid,lang.code+mainurl, callback)
                                       }
                                   ], function (err, results) {
                                       next()
                                   });

                               }else{
                                   var mainpath = path.join(staticFolderPath, staticFolderName, lang.code);
                                   url.splice(0, 1);
                                   var folders = url.map(function (folderName, instanceIndex) {
                                       var deferred = Q.defer();
                                       mainpath = path.join(mainpath, folderName);
                                       if (!fs.existsSync(mainpath))
                                           fs.mkdirSync(mainpath);
                                       deferred.resolve();
                                       return deferred.promise
                                   })
                                   return Q.all(folders)
                                       .then(function () {
                                           console.log("Static File Created Sucessfully");
                                           fs.writeFileSync(path.join(mainpath, 'index.html'), html, "utf-8");
                                           async.series([
                                               function (callback) {
                                                   createMapping(content_type_uid,lang.code+mainurl, callback)
                                               }
                                           ], function (err, results) {
                                               next()
                                           });
                                   })
                               }
                           }
                       })
                   }else{
                       console.log("Template is not present for url",mainurl)
                       next()
                   }
               }else{
                   console.log("This url is ignored");
                   next()
               }
           }else{
               console.log("Content Block Publishing")
               next()
           }
       } else {
           console.log("Asset Publishing");
           next()
       }
   };


  function createMapping(content_type_uid,pageURL,callback){
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
       if(data.content_type){
           if (data.content_type.options.is_page) {
               var lang = data.language,
                   mainurl = data.entry.url;
               if (mainurl == "/")
                 mainurl="/home"
               if (fs.existsSync(path.join(staticFolderPath, staticFolderName,lang.code,mainurl,'index.html')))
                   fs.unlinkSync(path.join(staticFolderPath, staticFolderName,lang.code,mainurl,'index.html'));
               next();
           }else{
               console.log("Content Block unpublish")
               deleteFolderRecursive(path.join(staticFolderPath,staticFolderName,lang.code))
               next()
           }
       }else{
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