
const PATH = require("path");
const FS = require("fs");
const EXEC = require("child_process").exec;
const SPAWN = require("child_process").spawn;
const CRYPTO = require("crypto");
const Q = require("sourcemint-util-js/lib/q");
const UTIL = require("sourcemint-util-js/lib/util");
const CREDENTIALS = require("./credentials");


var PrivateKey = exports.PrivateKey = function(credentials, path) {
	var self = this;
	self.credentials = credentials;
	self.ready = Q.when(((typeof self.credentials.ready === "function")?self.credentials.ready():self.credentials.ready), function() {

		self.name = self.credentials.makeRelativePath(path);
		if (/^\.\/keys\/[^\/]*$/.test(self.name)) {
			self.name = self.name.split("/").pop();
		}

		if (/^\//.test(path)) {
			self.path = path;
		} else {
			self.path = PATH.join(self.credentials.getDirname(), "keys", path);
		}

		if (!PATH.existsSync(self.path)) {
			if (!PATH.existsSync(PATH.dirname(self.path))) {
				FS.mkdirSync(PATH.dirname(self.path));
			}
			return Q.when(self.credentials.ready, function() {
				var shasum = CRYPTO.createHash("sha256");
				shasum.update(Math.random() + ":" + Date.now() + ":" + Math.random());
				var passphrase = shasum.digest("hex");
				return Q.when(self.credentials.set("github.com/sourcemint/credentials/-meta/ssh-private-key-passphrase/0", self.name, passphrase), function() {
					return self._call("/usr/bin/ssh-keygen", [
						"-t", "rsa",
						"-N", passphrase,
						"-f", self.path
					]);
				}).fail(function(err) {
					console.error(err.stack);
					throw err;
				});
			});
		}		
	});
}

PrivateKey.prototype.getFingerprint = function(format) {
	var self = this;
	return Q.when(self.ready, function() {
		return self._call("/usr/bin/ssh-keygen", [
			"-l",
			"-f", self.path + ".pub"
		]).then(function(result) {
			var m = result.match(/^\d*\s([^\s]*)\s/);
			if (!m) {
				throw new Error("Error parsing fingerprint: " + result);
			}
			return m[1];
		});			
	});
}

PrivateKey.prototype.getPassphrase = function() {
	var self = this;
	return Q.when(self.ready, function() {
		return self.credentials.get("github.com/sourcemint/credentials/-meta/ssh-private-key-passphrase/0", self.name);
	});
}

PrivateKey.prototype.ensureInAuthenticationAgent = function() {
	var self = this;
	return Q.when(self.ready, function() {
		return self.credentials.get("github.com/sourcemint/credentials/-meta/ssh-private-key-passphrase/0", self.name).then(function(passphrase) {
			// NOTE: This is tested on OSX. It may not work on other systems.
			// TODO: Only add if not already found (`ssh-add -l`).
			// TODO: Ensure is works on all systems.

			// @see https://developer.apple.com/library/mac/#documentation/Darwin/Reference/ManPages/man1/ssh-add.1.html
			// @see http://pentestmonkey.net/blog/ssh-with-no-tty

			var deferred = Q.defer();

			var env = UTIL.copy(process.env);
			env.DISPLAY = ":0";
			env.SSH_ASKPASS = PATH.join(__dirname, "ssh-askpass.js");
			env.SSH_ASKPASS_PASS = passphrase;

			return self._call("/usr/bin/ssh-add", [
				"-K", self.path
			], {
				env: env,
				verbose: true
			});
		});
	});
}

PrivateKey.prototype.getPublicKey = function(format) {
	var self = this;
	return Q.when(self.ready, function() {
		// TODO: Generate public key if it does not exist.
		return FS.readFileSync(self.path + ".pub").toString();
	});
}

PrivateKey.prototype._call = function(bin, args, options) {
	var deferred = Q.defer();
	options = options || {};
	// NOTE: `bin` should be an absolute path to ensure we get the correct binary.
	EXEC(bin + " " + args.join(" "), options, function(error, stdout, stderr) {
		if (options.verbose) {
			process.stdout.write(stdout);
			process.stdout.write(stderr);
		}
		if (error) {
			return deferred.reject(new Error("Error calling `" + bin + "`: " + stderr));
		}
		deferred.resolve(stdout);
	});
	return deferred.promise;
}
