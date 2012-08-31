
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const Q = require("sourcemint-util-js/lib/q");
const ERROR = require("sourcemint-util-js/lib/error");
const WAIT_FOR = require("sourcemint-util-js/lib/wait-for");
const FS_RECURSIVE = require("sourcemint-util-js/lib/fs-recursive");

const PROMPT_TEST_HELPERS = require("prompt/test/helpers");

const CREDENTIALS = require("../lib/credentials");
const ADAPTER_FILE_JSON = require("../lib/adapter/file-json");
const ADAPTER_OSX_SECURITY = require("../lib/adapter/osx-security");

const TMP_PATH = PATH.join(__dirname, ".tmp");


exports.main = function(callback) {

	console.log("Test credentials");

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
			["file-json", function() { return new ADAPTER_FILE_JSON.Adapter(PATH.join(TMP_PATH, "credentials-manual.json")); }, false],
			["file-json", function() { return new ADAPTER_FILE_JSON.Adapter(PATH.join(TMP_PATH, "credentials-manual.json")); }, true],
			["best", function() { return { dirname: TMP_PATH, filename: "credentials-best", password: password }; }, false],
			["custom1", function() { return { dirname: TMP_PATH, filename: "credentials-custom1", password: password, adapter: "file-json" }; }, false],
			["default", function() { return { dirname: TMP_PATH, password: password }; }, false]
		];
		if (process.platform === "darwin") {
			adapters.push(["osx-security", function() { return new ADAPTER_OSX_SECURITY.Adapter(PATH.join(TMP_PATH, "credentials-manual.keychain"), { password: password }); }, false]);
			adapters.push(["osx-security", function() { return new ADAPTER_OSX_SECURITY.Adapter(PATH.join(TMP_PATH, "credentials-manual.keychain"), { password: password }); }, true]);
			adapters.push(["custom2", function() { return { dirname: TMP_PATH, filename: "credentials-custom2", password: password, adapter: "osx-security" }; }, false]);
		}

		adapters.forEach(function(info) {
			waitFor(function(done) {

				console.log("Test adapter: " + info[0]);

				Q.when(info[1](), function(adapter) {

					var credentials = new CREDENTIALS.Credentials("default", adapter);

					if (info[2]) {
						// Credentials store exists.
						t2();
					} else {
						// Credentials store does not exist.
						t1();
					}

					// Prompt for value.
					function t1() {
						Q.when(credentials.requestFor("namespace1", "key1", {
							stdin: PROMPT_TEST_HELPERS.stdin,
							writeNextTick: "value1\n"
						}), function(value) {
							ASSERT.equal(value, "value1");
							process.stdout.write("\n");
							t2();
						}).fail(done);
					}

					// Value already set.
					function t2() {
						Q.when(credentials.requestFor("namespace1", "key1"), function(value) {
							ASSERT.equal(value, "value1");
							t3();
						}).fail(done);
					}

					var bigValue = "";
					for (var i=0 ; i<3000 ; i++) {
						bigValue += "x";
						if (i%70 === 0) bigValue += "\n";
					}

					// Prompt for big value.
					function t3() {
						Q.when(credentials.requestFor("namespace2", "key1", {
							stdin: PROMPT_TEST_HELPERS.stdin,
							writeNextTick: bigValue.replace(/\n/g, "\\n") + "\n"
						}), function(value) {
							ASSERT.equal(value, bigValue);
							process.stdout.write("\n");
							t4();
						}).fail(done);
					}

					// Big value already set.
					function t4() {
						Q.when(credentials.requestFor("namespace2", "key1"), function(value) {
							ASSERT.equal(value, bigValue);
							done();
						}).fail(done);
					}
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
