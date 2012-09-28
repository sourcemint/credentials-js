
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const Q = require("sourcemint-util-js/lib/q");
const ERROR = require("sourcemint-util-js/lib/error");
const WAIT_FOR = require("sourcemint-util-js/lib/wait-for");
const FS_RECURSIVE = require("sourcemint-util-js/lib/fs-recursive");

const CREDENTIALS = require("../lib/credentials");
const ADAPTER_FILE_JSON = require("../lib/adapter/file-json");
const ADAPTER_OSX_SECURITY = require("../lib/adapter/osx-security");
const SSH = require("../lib/ssh");

const TMP_PATH = PATH.join(__dirname, ".tmp");


exports.main = function(callback) {

	console.log("Test ssh");

	setup(function(err) {
		if (err) return callback(err);
		test(function(err) {
			if (err) return callback(err);
			teardown(function(err) {
				if (err) return callback(err);
				callback(null);
			});
		});
	});


	function test(callback) {

		var waitFor = WAIT_FOR.makeSerialWaitFor(callback);

		var password = "securityPassword2012";

		var adapters = [
			["file-json", { dirname: TMP_PATH, filename: "credentials1", password: password, adapter: "file-json" }, "key_rsa1"]
		];
		if (process.platform === "darwin") {
			adapters.push(["osx-security", { dirname: TMP_PATH, filename: "credentials2", password: password, adapter: "osx-security" }, "key_rsa2"]);
		}

		adapters.forEach(function(info) {
			waitFor(function(done) {

				console.log("Test adapter: " + info[0]);

				var credentials = new CREDENTIALS.Credentials("default", info[1]);

				var privateKey = new SSH.PrivateKey(credentials, PATH.join(TMP_PATH, info[2]));

				Q.when(privateKey.getPublicKey(), function(publicKey) {

					ASSERT(/^ssh-/.test(publicKey));
					ASSERT(publicKey.length > 200);

					return Q.when(privateKey.getPassphrase(), function(passphrase) {

						ASSERT(passphrase.length === 64);

						return Q.when(privateKey.getFingerprint(), function(fingerprint) {

							ASSERT(fingerprint.length === 47);
							ASSERT(fingerprint.split(":").length === 16);

							done();
						});
					});
				}).fail(done);
			});
		});
	}
}

function setup(callback) {
	if (PATH.existsSync(TMP_PATH)) {
		FS_RECURSIVE.rmdirSyncRecursive(TMP_PATH);
	}
	FS.mkdir(TMP_PATH);
	callback(null);
}

function teardown(callback) {
	callback(null);
}

if (require.main === module) {
	exports.main(function(err) {
		if (err) return ERROR.exitProcessWithError(err);
		console.log("OK");
		process.exit(0);
	});
}
