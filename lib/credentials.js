
const PROMPT = require("prompt");
const Q = require("sourcemint-util-js/lib/q");


var Credentials = exports.Credentials = function(profileName, adapter) {
	this.profileName = profileName;
	this.adapter = adapter;
}

// TODO: More standard newline conversion.
Credentials.prototype.requestFor = function(namespace, name, options) {
	var self = this;

	options = options || {};

	var key = [namespace, name];

	return Q.when(self.adapter.has(key), function(hasKey) {

		if (!hasKey) {
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

		} else {
			return Q.call(function() {
				return self.adapter.get(key);
			});
		}
	}).then(function(value) {
		return value.replace(/:-NL-:/g, "\n");
	});
}
