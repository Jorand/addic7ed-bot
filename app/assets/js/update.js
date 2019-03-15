const electron = require('electron');
const appVersion = electron.remote.app.getVersion();
const ipcRenderer = electron.ipcRenderer;

var shell = electron.remote.shell;

$("#version").text("v"+appVersion);

// wait for an updateReady message
ipcRenderer.on('updateReady', function(event, text) {
	console.log('updateReady', text);
	$('#update-button').show();
});

ipcRenderer.on('message', function(event, text) {
	console.log('message', text);
	$('#message').text(text);
});

$('#update-button').click((event) => {
	event.preventDefault();
	shell.openExternal('https://github.com/Jorand/addic7ed-bot/releases/latest');
});
