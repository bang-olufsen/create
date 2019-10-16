/*Copyright 2017-2019 Bang & Olufsen A/S
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

// BEOCREATE 2 LIST DEPENDENCIES
/*  This will crawl the following directories and list module dependencies:
	- beo-system (this directory)
	- beo-extensions
	- beocreate_essentials
	
	The script will avoid duplicates.
*/
console.log("\nListing Node modules used by Beocreate 2...\n");

var fs = require('fs');

var moduleList = [];
var systemDirectory = __dirname;


checkDirectory(systemDirectory);
checkDirectory(systemDirectory+"/../beocreate_essentials");

extensions = fs.readdirSync(systemDirectory+"/../beo-extensions");
for (var i = 0; i < extensions.length; i++) {
	checkDirectory(systemDirectory+"/../beo-extensions/"+extensions[i]);
}

function checkDirectory(path) {
	if (fs.statSync(path).isDirectory()) {
		console.log("Checking "+path+"...");
		if (fs.existsSync(path+"/package.json")) {
			packageJSON = JSON.parse(fs.readFileSync(path+"/package.json"));
			if (packageJSON.dependencies) {
				for (dependency in packageJSON.dependencies) {
					if (moduleList.indexOf(dependency) == -1) moduleList.push(dependency);
				}
			}
		}
	}
}

console.log("\nModules used in this installation:\n\n"+moduleList.join(" "));
process.exit(0);