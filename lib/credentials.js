
const ASSERT = require("assert");
const PATH = require("path");
const PROMPT = require("prompt");
const Q = require("sourcemint-util-js/lib/q");
const ADAPTER_FILE_JSON = require("./adapter/file-json");
const ADAPTER_OSX_SECURITY = require("./adapter/osx-security");


exports.getBestAdapter = function(dirname, options) {
	options = options || {};
	options.filename = options.filename || "credentials";
	return Q.call(function() {
		var opts = {};
		if (typeof options.password !== "undefined") {
			opts.password = options.password;
		}
		if (options.adapter === "osx-security" || (typeof options.adapter === "undefined" && process.platform === "darwin")) {
			// Is secure by default. If `!opts.password` OSX will prompt for password.
			return new ADAPTER_OSX_SECURITY.Adapter(PATH.join(dirname, options.filename + ".keychain"), opts);
		} else {
			// TODO: If `options.secure === true && !opts.password` prompt for password. `options.profileName` must be set.
			return new ADAPTER_FILE_JSON.Adapter(PATH.join(dirname, options.filename + ".json"), opts);
		}
	});
}


var Credentials = exports.Credentials = function(profileName, adapter) {

    if (!(this instanceof Credentials)) {
		// TODO: Make more generic & relocate to `sourcmeint-util-js`.
		var instance = null;
		function getInstance() {
			if (!instance) {
				instance = new exports.Credentials(profileName, adapter);
			}
			return instance;
		}
		var obj = {
			"ready": function() {
				var instance = getInstance();
				obj.profileName = instance.profileName;
				return getInstance().ready;
			}
		};
		[
			"getPath",
			"getDirname",
			"makeAbsolutePath",
			"makeRelativePath",
			"set",
			"get",
			"remove",
			"requestFor"
		].forEach(function(method) {
			obj[method] = function() {
				var args = arguments;
				var instance = getInstance();
				return instance[method].apply(instance, args);
			};
		});
		return obj;
    }

	var self = this;
	self.profileName = profileName;
	if (typeof adapter.set === "function") {
		self.adapter = adapter;
		self.ready = Q.ref();
	} else
	if (typeof adapter.dirname === "string") {
		adapter.profileName = self.profileName;
		self.ready = exports.getBestAdapter(adapter.dirname, adapter).then(function(adapter) {
			self.adapter = adapter;
		});
	} else {
		throw new Error("Invalid constructor arguments!");
	}
}

Credentials.prototype.getPath = function() {
	return this.adapter.getPath();
}

Credentials.prototype.getDirname = function() {
	return this.adapter.getDirname();
}

Credentials.prototype.makeAbsolutePath = function(path) {
	if (path && /^\./.test(path)) {
		return PATH.join(this.getDirname(), path);
	}
	if (path && /^~\//.test(path)) {
		ASSERT(typeof process.env.HOME !== "undefined", "`process.env.HOME` is required!");
		return PATH.join(process.env.HOME, path);
	}
	return path;
}

Credentials.prototype.makeRelativePath = function(path) {	
	var dirname = this.getDirname();
	if (path.substring(0, dirname.length+1) === dirname + "/") {
		return "." + path.substring(dirname.length);
	}
	if (process.env.HOME && path.substring(0, process.env.HOME.length+1) === process.env.HOME + "/") {
		return "~" + path.substring(process.env.HOME.length);
	}
	return path;
}

Credentials.prototype.set = function(namespace, name, value) {
	var self = this;

	var key = [namespace, name];

	return Q.when(self.ready, function() {
		return self.adapter.set(key, value);
	});
}

Credentials.prototype.get = function(namespace, name) {
	var self = this;

	var key = [namespace, name];

	return Q.when(self.ready, function() {
		return self.adapter.get(key);
	});
}

Credentials.prototype.remove = function(namespace, name) {
	var self = this;

	var key = [namespace, name];

	return Q.when(self.ready, function() {
		return self.adapter.remove(key);
	});
}

// TODO: More standard newline conversion.
Credentials.prototype.requestFor = function(namespace, name, options) {
	var self = this;

	options = options || {};

	var key = [namespace, name];

	return Q.when(self.ready, function() {

		return Q.when(self.adapter.has(key), function(hasKey) {

			if (!hasKey) {

				return Q.call(function() {
					if (options.fetcher) {
						return options.fetcher(namespace, name, options).then(function(value) {
							return Q.when(self.adapter.set(key, value), function() {
								return value;
							});
						});
					}
				}).then(function(value) {
					if (value !== null) return value;

					var deferred = Q.defer();

					// Used for testing.
					if (typeof options.stdin !== "undefined") {
						PROMPT.started = false;
						PROMPT.start({
							stdin: options.stdin
						});
					} else {
						PROMPT.start();
					}

					PROMPT.get({
					    properties: {
					        field: {
					        	message: "Please provide '" + self.profileName + "/" + namespace + "/" + name + "':",
					      		required: true,
								hidden: options.hidden || false
					    	}
					  	}
					}, function (err, result) {
						if (err) {
							return deferred.reject(err);
						}

						var value = result.field.replace(/\\n/g, ":-NL-:");

						Q.when(self.adapter.set(key, value), function() {
							deferred.resolve(value);
						}, deferred.reject);
					});

					// Used for testing.
					if (typeof options.stdin !== "undefined" && typeof options.writeNextTick !== "undefined") {
						// Simulate user input.
						options.stdin.writeNextTick(options.writeNextTick);
					}

					return deferred.promise;
				});
			} else {
				return Q.call(function() {
					return self.adapter.get(key);
				});
			}
		}).then(function(value) {
			return value.replace(/:-NL-:/g, "\n");
		});
	});
}
