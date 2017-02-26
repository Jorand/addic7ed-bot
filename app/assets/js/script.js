/**** Dependencies ****/
var addic7edApi = require('addic7ed-api');
var tnp = require('torrent-name-parser');

var remote = require('electron').remote;
var dialog = remote.dialog;
var shell = remote.shell;

var subtitle_lang, subtitle_lang_default = "fre"; //eng
var version_map = {
	"HDTV": "(DIMENSION|LOL)",
	"WEB-DL": "WEB-DL"
};

function setText(msg) {
	$drop.find('.txt').html(msg);
}

// DROP
var $drop = $("#drop"); // Drop zone

var drop_in_progress = false;

$drop.on("dragover", function(event) {
	event.preventDefault();
	$(this).addClass('hover');
	setText("Drop the file !");
});

$drop.on("dragleave", function(event) {
	event.preventDefault();
	$(this).removeClass('hover');
	setText("Drop your file here :)");
});

$drop.on("dragend", function(event) {
	event.preventDefault();
});

$drop.on("drop", function(event) {
	event.preventDefault();

	console.log(drop_in_progress);

	if (drop_in_progress == false) {
		drop_in_progress = true;

		refreshSettings();

		for (let f of event.originalEvent.dataTransfer.files) {

			var full_path = f.path;

			var path_regex = /.*\//g;
			var file = full_path;
			var file_dir = "./";
			if (full_path.indexOf('/') > -1) {
				var full_path_splitted = full_path.split('/');
				file = full_path_splitted[full_path_splitted.length-1];
				file_dir = path_regex.exec(full_path)[0];
			}

			var file_wo_extention_regex = /(.*)\./g;
			var file_wo_extention = file_wo_extention_regex.exec(file)[1];
			console.log(file_wo_extention);

			var show = tnp(file_wo_extention);

			if (show.season && show.episode) {

				show.version_addicted = new RegExp(version_map[show.group]);

				console.log(show);
				
				var str_filename = file_dir + file_wo_extention + '.srt';

				setText("Searching for <br>"+show.title+"<br> season: "+show.season+" espisode: "+show.episode+"<br> Please wait …");

				console.log(subtitle_lang);

				addic7edApi.search(show.title, show.season, show.episode, subtitle_lang).then(function (subtitlesList) {

					var last_updated_version = 0,
						last_updated_version_i = 0,
						i;

					for (i = 0; i < subtitlesList.length; ++i) {
						s = subtitlesList[i];
						if (show.version_addicted.test(s['version'])) {
							s_link = s['link'].split('/');
							updated_version = s_link[s_link.length-1];
							if (updated_version > last_updated_version){
								last_updated_version = updated_version;
								last_updated_version_i = i;
							}
						}
					}

					var sub = subtitlesList[last_updated_version_i];

					if (sub) {
						addic7edApi.download(sub, str_filename).then(function () {
							console.log('Subtitles file saved to ' + str_filename);
							setText("Subtitle downloaded ! Enjoy :)");
							shell.openItem(full_path);
							$drop.removeClass('hover');
							drop_in_progress = false;
						});
					}
					else {
						drop_in_progress = false;
					}
				});
			}
			else {
				setText("Oups, The parser did not succeed !");
				$drop.removeClass('hover');
				drop_in_progress = false;
			}
		}
	}
});

// NAV
function sectionGo(id) {
	var target = $('#section-'+id);
	if (target) {
		$('.section').removeClass('show');
		target.addClass('show');
	}
}

$('[data-go]').click(function(event) {
	event.preventDefault();
	var taget = $(this).data("go");
	sectionGo(taget);
});


// POPCORN TIME
var ip;
var port;
var username;
var password;
var connected = false;
var view = "";

getRemoteSettings();	
checkConnected(true);
var popInterval = setInterval(function() {
	callPopcornApi("getviewstack");
}, 1000);

var pop_dl_in_progress = false;

var currentShow = null;


$('#button-settings-reload').click(function(event) {
	event.preventDefault();
	refreshSettings();
});

$("#ip").on('input', function(){
	window.localStorage.setItem("ip", $(this).val());
	refreshSettings();
});
$("#port").on('input', function(){
	window.localStorage.setItem("port", $(this).val());
	refreshSettings();
});
$("#username").on('input', function(){
	window.localStorage.setItem("username", $(this).val());
	refreshSettings();
});
$("#password").on('input', function(){
	window.localStorage.setItem("password", $(this).val());
	refreshSettings();
});

var popcorn_time_cache_subtitlesList = null;

$('.popcorntime-list-close').click(function(event) {
	event.preventDefault();
	$('.popcorntime-popover-list').hide();
});

$('#popcorn-time-list').click(function(event) {
	event.preventDefault();
	event.preventDefault();

	$('.popcorntime-popover').hide();
	$('.popcorntime-popover-loader').show();

	var $list = $('.popcorntime-subtitles-list');
	
	pop_dl_in_progress = true;

	var file = currentShow.result.title;

	var show = currentShow.tnp;

	setText("Searching for <br>"+show.title+"<br> season: "+show.season+" espisode: "+show.episode);

	addic7edApi.search(show.title, show.season, show.episode, subtitle_lang).then(function (subtitlesList) {

		console.log(subtitlesList);

		$list.html('');

		var last_updated_version = 0,
			last_updated_version_i = 0,
			i;

		for (i = 0; i < subtitlesList.length; ++i) {
			var s = subtitlesList[i];
			var s_link = s['link'].split('/');
			var updated_version = s_link[s_link.length-1];
			
			$list.append('<li><a class="popcorntime-sub" href="#" data-index="'+i+'">Version '+s['version']+', '+s['lang']+'</a></li>');
		}

		$('.popcorntime-popover-list').show();

		popcorn_time_cache_subtitlesList = subtitlesList;

	});
});

$('.popcorntime-subtitles-list').delegate('a','click',function() {
	event.preventDefault();
	var index = $(this).data('index');

	if (popcorn_time_cache_subtitlesList && popcorn_time_cache_subtitlesList[index] ) {

		var sub = popcorn_time_cache_subtitlesList[index];

		var show = currentShow.tnp;

		if (sub) {

			var str_filename = show.title.replace(' ', '.') + '.S'+show.season+'E'+show.episode+'.FRE.'+sub.version+'.srt'; 

			dialog.showOpenDialog({
				title:"Select a folder",
				properties: ["openDirectory"]
			},function (folderPaths) {

				$('.popcorntime-popover-loader').hide();
				// folderPaths is an array that contains all the selected paths
				if(folderPaths === undefined){
					setText("Oups, no destination folder selected !");
					pop_dl_in_progress = false;
					return;
				}
				else {

					var str_path = folderPaths[0]+'/'+str_filename;

					addic7edApi.download(sub, str_path).then(function () {

						$('.popcorntime-popover-list').hide();

						console.log('Subtitles file saved to ' + str_path);
						setText('Subtitles file saved ! Enjoy :)');

						shell.showItemInFolder(str_path);

						pop_dl_in_progress = false;

					});
				}
			});
		}
		else {
			$('.popcorntime-popover-loader').hide();
			setText("Oups, no subtitles found !");
			pop_dl_in_progress = false;
		}
	}
});

$('#popcorn-time-yes').click(function(event) {
	event.preventDefault();
	$('.popcorntime-popover').hide();
	$('.popcorntime-popover-loader').show();
	
	pop_dl_in_progress = true;

	var file = currentShow.result.title;

	var show = currentShow.tnp;

	show.version_addicted = new RegExp(version_map[show.group]);

	setText("Searching for <br>"+show.title+"<br> season: "+show.season+" espisode: "+show.episode);

	addic7edApi.search(show.title, show.season, show.episode, subtitle_lang).then(function (subtitlesList) {

		var last_updated_version = 0,
			last_updated_version_i = 0,
			i;

		for (i = 0; i < subtitlesList.length; ++i) {
			s = subtitlesList[i];
			if (show.version_addicted.test(s['version'])) {
				s_link = s['link'].split('/');
				updated_version = s_link[s_link.length-1];
				if (updated_version > last_updated_version){
					last_updated_version = updated_version;
					last_updated_version_i = i;
				}
			}
		}

		var sub = subtitlesList[last_updated_version_i];

		if (sub) {

			var str_filename = show.title.replace(' ', '.') + '.S'+show.season+'E'+show.episode+'.FRE';

			if (sub.version) {
				str_filename += '.'+sub.version; 
			}

			str_filename += '.srt';

			dialog.showOpenDialog({
				title:"Select a folder",
				properties: ["openDirectory"]
			},function (folderPaths) {

				$('.popcorntime-popover-loader').hide();
				// folderPaths is an array that contains all the selected paths
				if(folderPaths === undefined){
					setText("Oups, no destination folder selected !");
					pop_dl_in_progress = false;
					return;
				}
				else {

					var str_path = folderPaths[0]+'/'+str_filename;

					addic7edApi.download(sub, str_path).then(function () {
						console.log('Subtitles file saved to ' + str_path);
						setText('Subtitles file saved ! Enjoy :)');

						shell.showItemInFolder(str_path);

						pop_dl_in_progress = false;

					});
				}
			});
		}
		else {
			$('.popcorntime-popover-loader').hide();
			setText("Oups, no subtitles found !");
			pop_dl_in_progress = false;
		}

	});

});

function showNotice() {
	if (!pop_dl_in_progress) {
		$('.popcorntime-popover').show();
	}
}

function hideNotice() {
	if (!pop_dl_in_progress) {
		$('.popcorntime-popover').hide();
	}
}

function popcorntimeNotifySub() {

	var isShow = function(data) {
		//The Magicians S2 E4 - The Flying Forest
		// The Flash S3 E13 - Attack on Gorilla City (1)
		var title_tpn = data.result.title.replace(/ - /g, ' ').replace(/,/g, '').replace('Season ', 'S').replace('Episode ', 'E');
		
		var regexp = new RegExp(/([S|E])([0-9]+)/, 'ig');
		title_tpn = title_tpn.replace(regexp, function(match, p1, p2, p3, offset, string) {
			return p1+''+pad(p2);
		});

		var show = tnp(title_tpn);
		console.log(data, title_tpn,show);

		if (show.season && show.episode) {
			data.tnp = show;
			currentShow = data;
			showNotice();
		}
		else {
			hideNotice();
		}
	};

	callPopcornApi("getplaying", function(data) {
		if (data.result.title) {
			isShow(data);
		}
		
	});

	callPopcornApi("getloading", function(data) {
		if (data.result && data.result.title) {
			isShow(data);
		}
	});
}

function callPopcornApi(method, params, callback) {	//popcorn api wrapper

	//console.log(method);

	if (!window.connected) {
		return false;
	}
	if(typeof params === "undefined") {
		params = [];
	}
	if(typeof params === "function") {
		callback = params;
		params = [];
	}
	
	var request = {};
	request.params = params;
	request.id = 10;
	request.method = method;
	request.jsonrpc = "2.0";
	
	$.ajax({
		type: 'POST',
		url: 'http://' + window.ip + ':' + window.port,
		data: JSON.stringify(request),
		beforeSend: function (xhr) { 
			xhr.setRequestHeader('Authorization', window.btoa(window.username + ":" + window.password)); 
		},
		success: function(data, textStatus) {
			//console.log(data);
			if(request.method == 'getviewstack') { //if viewstack is checked call viewstackhandler
				viewstackhandler(data);
			}
			else if (callback !== undefined) {
				callback(data);
			}
		},
		error: function (request, status, error) {
			console.error("[ERROR] Could not connect to given client.");
			alertPop("Could not connect to Popcorn Time. Please check your settings.");
			window.connected = false;
			hideNotice();
		}	
	});
	
}

function viewstackhandler(data){	
	//console.log(data);
	// Pre 0.3.4 
	if( typeof(data.result.butterVersion) == "undefined" ) { //check if using an old before 0.3.4
		currentview = data.result[0][data.result[0].length - 1];
	}
	else { // 0.3.4 or higher
		currentview = data.result.viewstack[data.result.viewstack.length - 1];
	}

	if(window.view != currentview &&	$("#settings").is(":visible") == false ) { //check if view is changed
		console.debug("[DEBUG] Current view: " + currentview);
		switch(currentview) {
			case 'shows-container-contain':
				//showsContainer();
				hideNotice();
				break;
			case 'main-browser':
				//mainBrowser(); 
				hideNotice();
				break;
			case 'movie-detail':
				//movieDetail();
				hideNotice();
				break;
			case 'app-overlay':
				//player();
				popcorntimeNotifySub();
			case 'player':
				//player();
				popcorntimeNotifySub();
			case 'notificationWrapper':
				//player();
				popcorntimeNotifySub();
			break;
			default:
				hideNotice();
				console.debug("[DEBUG] Current view: " + currentview);
		}
		view = currentview;
	}
}


function closeSettings() {
	sectionGo('home');
	window.view = ""; 
	callPopcornApi("getviewstack"); 
}

function getRemoteSettings() {
	console.debug("[DEBUG] Port: "+window.localStorage.getItem("port"));
	
	//check port
	if(window.localStorage.getItem("port") == null) {
		window.localStorage.setItem("port", "8008");
	}
	
	//check username
	if(window.localStorage.getItem("username") == null) {
		window.localStorage.setItem("username", "popcorn");
	}
	
	//check password
	if(window.localStorage.getItem("password") == null) {
		window.localStorage.setItem("password", "popcorn");
	}

	//check password
	if(window.localStorage.getItem("subtitle_lang") == null) {
		window.localStorage.setItem("subtitle_lang", subtitle_lang_default);
	}
	
	$("#ip").val(window.localStorage.getItem("ip"));
	
	$("#port").val(window.localStorage.getItem("port"));
	
	$("#username").val(window.localStorage.getItem("username"));
	
	$("#password").val(window.localStorage.getItem("password"));

	$("#subtitle_lang").val(window.localStorage.getItem("subtitle_lang"));
	
	refreshSettings();
}

function refreshSettings() {

	window.ip = window.localStorage.getItem("ip");
	window.port = window.localStorage.getItem("port");
	window.username = window.localStorage.getItem("username");
	window.password = window.localStorage.getItem("password");
	subtitle_lang = window.localStorage.getItem("subtitle_lang");
	console.log(subtitle_lang);
	checkConnected(false);
	console.debug("[DEBUG] Settings refreshed.");
}

function checkConnected(warning) {
	var request = {};
		
	request.params = [];
	request.id = 10;
	request.method = 'ping';
	request.jsonrpc = "2.0";
	
	$.ajax({
		type: 'POST',
		url: 'http://' + window.ip + ':' + window.port,
		data: JSON.stringify(request),
		//dataType: 'json', 
		beforeSend: function (xhr){ 
			xhr.setRequestHeader('Authorization', window.btoa(window.username + ":" + window.password)); 
		},
		success: function(data, textStatus) {
			if(typeof data.error == "undefined") { //check if there are no errors
				console.info("[INFO] Connection established.");
				//closeSettings();
				window.connected = true;
				alertPop("Connected :)");
			}
			else { //there are errors
				if(warning){
					console.error("[ERROR] Invalid login credentials.");
					alertPop("Invalid login credetials provided.");
				}
				window.connected = false;
			}
		},
		error: function() {
			if(warning) {
				console.error("[ERROR] Could not connect to given client.");
				alertPop("Could not connect to Popcorn Time. Please check your settings.");
			}
			window.connected = false;
		}
	});
}

function alertPop(msg) {
	$('.alert-pop').text(msg);
}

function pad(n) {
	return (n < 10) ? ("0" + n) : n;
}