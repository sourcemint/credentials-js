
const PATH = require("path");
const EXEC = require("child_process").exec;
const Q = require("sourcemint-util-js/lib/q");


var Adapter = exports.Adapter = function(path, options) {
	var self = this;
	options = options || {};
	self.path = path;
	self.ready = Q.ref();
	if (!PATH.existsSync(self.path)) {
		self.ready = Q.call(function() {
			var args = [
				"-P"
			];
			if (typeof options.password !== "undefined") {
				args = [
					"-p", options.password
				];
			}
			return self._call("create-keychain", args).fail(function(err) {
				console.error(err.stack);
				throw err;
			});
		});
	}
}

Adapter.prototype.has = function(key) {
	return Q.when(this.get(key), function(value) {
		return (value === false) ? false : true;
	});
}

Adapter.prototype.get = function(key) {
	var self = this;
	return Q.when(this.ready, function() {
		return self._call("find-generic-password", [
			"-g",
			"-a", "Sourcemint",
			"-s", key.join("/")
		]).then(function(result) {
			if (result === false) {
				return false;
			}
			var password = result.match(/password: "([^"]*)"/);
			if (!password) {
				return false;
			}
			return password[1];
		});
	}).fail(function(err) {
		console.error(err.stack);
		throw err;
	});
}

Adapter.prototype.set = function(key, value) {
	var self = this;
	return Q.when(this.ready, function() {
		return self._call("add-generic-password", [
			"-a", "Sourcemint",
			"-s", key.join("/"),
			"-l", key.join("/"),
			"-w", '"' + value + '"'
		]).then(function(result) {
			return true;
		});
	}).fail(function(err) {
		console.error(err.stack);
		throw err;
	});
}

Adapter.prototype._call = function(action, args) {
	var deferred = Q.defer();
	// NOTE: We are using an absolute path to ensure we get the correct binary.
	EXEC("/usr/bin/security -q " + action + " " + args.join(" ") + " " + this.path, function(error, stdout, stderr) {
		if (action === "find-generic-password") {
			if (/The specified item could not be found in the keychain/.test(stderr)) {
				return deferred.resolve(false);
			} else {
				return deferred.resolve(stderr);
			}
		} 
		if (error) {
			return deferred.reject(new Error("Error calling `security`: " + stderr));
		}
		deferred.resolve(stdout);
	});
	return deferred.promise;
}
