const electron = require('electron');
const appVersion = electron.remote.app.getVersion();
const ipcRenderer = electron.ipcRenderer;

$("#version").text("v"+appVersion);

// wait for an updateReady message
ipcRenderer.on('updateReady', function(event, text) {
	console.log('updateReady', text);
	$('#update-button').show();
})

$('#update-button').click((event) => {
	event.preventDefault();
	ipcRenderer.send('quitAndInstall')
})