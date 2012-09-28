
const PATH = require("path");
const JSON_STORE = require("sourcemint-util-js/lib/json-store").JsonStore;


var Adapter = exports.Adapter = function(file) {
	this.file = file;
    if (!this.exists()) {
        this.init();
    }
}

Adapter.prototype = new JSON_STORE();

Adapter.prototype.getDirname = function() {
	return PATH.dirname(this.file);
}
