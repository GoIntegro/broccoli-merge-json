var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var helpers = require('broccoli-kitchen-sink-helpers');
var Writer = require('broccoli-writer');
var changeCase = require('change-case');

module.exports = Merger;
Merger.prototype = Object.create(Writer.prototype);
Merger.prototype.constructor = Merger;

function Merger (inputTree, options) {
  if (!(this instanceof Merger)) return new Merger(inputTree, options);
  this.inputTree = inputTree;
  this.options = options || {};
}


function addObject(currentObject, path, objectToAdd) {
  var prop = path[0];
  prop = changeCase.camel(prop);

  if (path.length === 1) {
    if (prop.toLowerCase() === "index") {
      //copy properties from objectToAdd to currentObject
      Object.keys(objectToAdd).forEach(function(key) {
        currentObject[key] = objectToAdd[key];
      });
    } else {
      if (typeof(currentObject[prop]) === "object") {
        //copy properties from objectToAdd to currentObject[prop]
        var objectToAddTo = currentObject[prop];
        Object.keys(objectToAdd).forEach(function(key) {
          objectToAddTo[key] = objectToAdd[key];
        });
      } else {
        currentObject[prop] = objectToAdd;
      }
    }
  } else {
    var nextObject = currentObject[prop] || {};
    currentObject[prop] = nextObject;
    addObject(nextObject, path.slice(1), objectToAdd);
  }
}

Merger.prototype.write = function (readTree, destDir) {
  var self = this;

  return readTree(this.inputTree).then(function (srcDir) {
    var sourcePath = path.join(srcDir, self.options.srcDir);
    var destPath   = path.join(destDir, self.options.destDir);
    var outputAsModule = self.options.outputAsModule ? true : false;

    if (destPath[destPath.length -1] === '/') {
      destPath = destPath.slice(0, -1);
    }

    if (!fs.existsSync(destPath)) {
      mkdirp.sync(destPath);
    }

    var subDirNames = fs.readdirSync(sourcePath).filter(function(d) {
      // d are the subdir
      var stats = fs.statSync(path.join(sourcePath, d));
      return d[0] != '.' && stats.isDirectory(); // exclude anything that starts with a . and isn't a directory
    });

    var output = {};
    var outputFile = path.join(destPath, self.options.destFileName);

    subDirNames.forEach(function(subDirName) {
      var filesDir = path.join(sourcePath, subDirName);
      var inputFiles = helpers.multiGlob(['**/*.json'], {cwd: filesDir});

      inputFiles.forEach(function(inputFile) {
        var parts = inputFile.split("/");
        var language = path.basename(inputFile, '.json');        
        var fileContent = JSON.parse(fs.readFileSync(path.join(filesDir, inputFile)));

        // set the language as the root part
        parts.unshift(language);
        // remove the file name as a key
        parts.pop();
        addObject(output, parts, fileContent);
      });
    });

    var finalOutput = JSON.stringify(output),
        template = self.options.template;
    if(template) {
      finalOutput = template.replace('{{content}}', finalOutput);
    } 
    fs.writeFileSync(outputFile, finalOutput);
  });
}
