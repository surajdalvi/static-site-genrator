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




