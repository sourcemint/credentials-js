
const PATH = require("path");
const FS = require("fs");
const EXEC = require("child_process").exec;
const Q = require("sourcemint-util-js/lib/q");
const CREDENTIALS = require("./credentials");


var PrivateKey = exports.PrivateKey = function(credentials, name, path) {
	var self = this;
	self.credentials = credentials;
	self.name = name;
	self.path = path;
	if (!PATH.existsSync(self.path)) {
		self.ready = Q.call(function() {
			// TODO: Generate passphrase hash.
			var passphrase = "secure-passphrase-hash";

			return Q.when(self.credentials.set("ssh/" + self.name, "passphrase", passphrase), function() {
				return self._call([
					"-t", "rsa",
					"-N", passphrase,
					"-f", self.path
				]).then(function() {
					var key = FS.readFileSync(path + ".pub").toString().replace(/\n$/, "");
					key = key.replace(/\s\S*$/, " " + self.name + "@" + credentials.profileName);
					return self.credentials.set("ssh/" + self.name, "public.key", key);
				});
			}).fail(function(err) {
				console.error(err.stack);
				throw err;
			});
		});
	} else {
		self.ready = Q.ref();
	}
}

PrivateKey.prototype.getPublicKey = function() {
	var self = this;
	return Q.when(self.ready, function() {
		return self.credentials.get("ssh/" + self.name, "public.key");
	});
}

PrivateKey.prototype._call = function(args) {
	var deferred = Q.defer();
	// NOTE: We are using an absolute path to ensure we get the correct binary.
	EXEC("/usr/bin/ssh-keygen " + args.join(" "), function(error, stdout, stderr) {
		if (error) {
			return deferred.reject(new Error("Error calling `ssh-keygen`: " + stderr));
		}
		deferred.resolve(stdout);
	});
	return deferred.promise;
}
