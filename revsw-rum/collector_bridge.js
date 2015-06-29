var socket = require("websocket");
var settings = require("./config/config");
var BridgeClient = socket.client;
var client = null;
exports.init = function(callback) {
	client = new BridgeClient();
	console.log(settings.collector_bridge.url,settings.collector_bridge.name);
	client.connect(settings.collector_bridge.url,settings.collector_bridge.name);
	client.on("connect", function(connection){
		connection.on("error", function(error){
			console.log("Connection Error: " + error.toString());
		});
		connection.on('close', function() {
			console.log('Websocket Connection Closed');
		});
		callback(connection);
	});
}
