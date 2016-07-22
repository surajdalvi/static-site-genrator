var exports = module.exports = {},
     gulp = require('gulp'),
    path = require('path'),
    fs = require('fs'),
    Q = require('q');

exports.fileChanges = function(staticFolderPath,staticFolderName,temppath) {
    gulp.task('default', function () {
        var changePath = path.join(temppath, "*", "*.html")
        var changePath1 = path.join(temppath, "*", "*", "*.html")
        gulp.watch(changePath, function (event) {
            deleteFolderRecursive(path.join(staticFolderPath, staticFolderName))

        });
        gulp.watch(changePath1, function (event) {
            var os = process.platform;
            var content_type = event.path;
            if (os.indexOf("win") == 0) {
                content_type = content_type.split("\\");
            } else {
                content_type = content_type.split("/");
            }
            var len = content_type.length;
            content_type = content_type[len - 2]
            try {
                var mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapping.json'), 'utf8'));
                if (mapping[content_type]) {
                    var urls = mapping[content_type]
                    var allurls = urls.map(function (url, instanceIndex) {
                        var deferred = Q.defer();
                        if (fs.existsSync(path.join(staticFolderPath, staticFolderName, url, 'index.html'))) {
                            fs.unlinkSync(path.join(staticFolderPath, staticFolderName, url, 'index.html'));
                        }
                        deferred.resolve();
                        return deferred.promise
                    })
                    return Q.all(allurls)
                        .then(function () {
                            console.log("Template  Changes entry delated  ")
                        })
                }
            } catch (e) {
                console.log("Template Change Eroor:::", e)
            }

        });

    })

    gulp.start('default');
};

exports.restartAPP = function(app,temppath,staticFolderPath, staticFolderName) {
    gulp.task('restart', function () {
        var tempalte1=path.join(temppath,"pages","home","index.html")
        var content1={"updated_at":"2016-07-22T07:11:04.858Z","created_at":"2016-07-22T07:11:04.791Z","title":"Home page","url":"/home","rich_text_editor":"<p>Suraj Dalvi</p>","group":[{"file":[{"uid":"blt31904dd2e04aad05","created_at":"2016-07-22T07:10:44.624Z","updated_at":"2016-07-22T07:10:44.624Z","created_by":"sys_bltd0f5afe859218f50","updated_by":"sys_bltd0f5afe859218f50","content_type":"image/jpeg","file_size":"13046","tags":[],"filename":"download (1).jpg","url":"https://api.contentstack.io/v2/assets/5791c6f46ba42bdd1d09d32a/download?uid=blt31904dd2e04aad05","_internal_url":"/assets/blt31904dd2e04aad05/download (1).jpg"}]},{"file":[{"uid":"blt699202cafab92bca","created_at":"2016-07-22T07:10:50.281Z","updated_at":"2016-07-22T07:10:50.281Z","created_by":"sys_bltd0f5afe859218f50","updated_by":"sys_bltd0f5afe859218f50","content_type":"image/jpeg","file_size":"7687","tags":[],"filename":"test.jpg","url":"https://api.contentstack.io/v2/assets/5791c6fa7be2f1ca1f3812f9/download?uid=blt699202cafab92bca","_internal_url":"/assets/blt699202cafab92bca/test.jpg"}]},{"file":[{"uid":"blt8f6e89839219dfae","created_at":"2016-07-22T07:10:55.525Z","updated_at":"2016-07-22T07:10:55.525Z","created_by":"sys_bltd0f5afe859218f50","updated_by":"sys_bltd0f5afe859218f50","content_type":"image/jpeg","file_size":"9451","tags":[],"filename":"download.jpg","url":"https://api.contentstack.io/v2/assets/5791c6ff3e2771e3206ade36/download?uid=blt8f6e89839219dfae","_internal_url":"/assets/blt8f6e89839219dfae/download.jpg"}]}],"_metadata":{"locale":"en-us","uid":"blt5df56cc1cebcd5a0"},"tags":[],"updated_by":"sys_bltd0f5afe859218f50","created_by":"sys_bltd0f5afe859218f50","uid":"blt5df56cc1cebcd5a0","_version":1,"published_at":"2016-07-22T09:14:27.602Z"}
        app.render(tempalte1, {entry: content1}, function (err, html) {
            if(err){
                console.log("error:::",err)
            }else{
                console.log("sucess:::",html)
                fs.writeFileSync(path.join(staticFolderPath, staticFolderName,'index.html'), html, "utf-8");
            }
        })
    })
    gulp.start('restart');
}

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




