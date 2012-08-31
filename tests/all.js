

function main(callback) {

	require("./credentials").main(function(err) {
		if (err) return callback(err);
	require("./ssh").main(function(err) {
		if (err) return callback(err);
	});
	});

}


if (require.main === module) {
	main(function(err) {
		if (err) return ERROR.exitProcessWithError(err);
		console.log("OK");
		process.exit(0);
	});
}
