const electron = require('electron');
const appVersion = electron.remote.app.getVersion();
const ipcRenderer = electron.ipcRenderer;

$("#version").text("v"+appVersion);

// wait for an updateReady message
ipcRenderer.on('updateReady', function(event, text) {
	$('#update-button').show();
	// changes the text of the button
	var container = document.getElementById('ready');
	container.innerHTML = "new version ready!";
})