// Dependencies
var addic7edApi = require('addic7ed-api');
var remote = require('electron').remote;
var dialog = remote.dialog;
var shell = remote.shell;

// Settings
var subtitle_lang_default = "fre";
var subtitle_lang;

// popcorntime remote
var ip;
var port;
var username;
var password;
var connected = false;
var view = "";

$(document).ready(function() {

	var $drop = $("#drop"); // Drop zone

	function setText(msg) {
		$drop.find('.txt').html(msg);
	}

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

		for (let f of event.originalEvent.dataTransfer.files) {

			var show = parseName(f.name);
			show['path'] = f.path;
			show['filename'] = f.name;

			console.log(show);

			// Check if [eztv] in filename
			if (show.filename.match(/\[eztv\]/)) {
				setText("Searching for <br>"+show.name+"<br> season: "+show.season+" espisode: "+show.episode+"<br> Please wait …");

				getSub(show);
			}
			else {
				setText("Oups, not supported filename !");
			}

			
		}
	});

	function parseName(name) {
		var result = [];

		// get title, season, episode
		var regex = /(.*?)\.S([0-9]+)E([0-9]+)/;
		if(regex.test(name)) {
			var find = name.match(regex);

			result['name'] = find[1];
			result['season'] = find[2];
			result['episode'] = find[3];
		}

		// get version
		var regexTeam = /([^-]+)\[eztv]/;
		if(regexTeam.test(name)) {
			var findTeam = name.match(regexTeam);
			result['version'] = findTeam[1];
		}

		// 720p
		var hdtv720 = name.search("720");
		if (hdtv720.length !== -1) {
			result['hdtv720'] = true;
		}
		else {
			result['hdtv720'] = false;
		}

		return result;
	}

	function getSub(show) {
		if (show['name'] && show['season'] && show['episode']) {

			addic7edApi.search(show.name, show.season, show.episode, subtitle_lang).then(function (subtitlesList) {

				if (subtitlesList.length > 1) {

					var bestScorefind = 0;

					for (var i = 0; i < subtitlesList.length; ++i) {
						var s = subtitlesList[i];
						s.score = 0;
						console.log(s);

						var regVersion = new RegExp(show.version,"gi");

						if (show.version && s.version.match(regVersion)) {
							subtitlesList[i].score++;
							if (subtitlesList[i].score > bestScorefind)
								bestScorefind = subtitlesList[i].score;
						}

						// ADD params here

						// var reg720 = new RegExp("720","gi");

						// if (show.hdtv720 && s.version.match(reg720)) {
						// 	if (version_addicted.test(s['version'])) {
						// }


					}

					// Get the highest score
					var bestScore = $.grep(subtitlesList, function(e){ return e.score == bestScorefind; });
					console.log(bestScore);

					if (bestScore.length == 1) {
						// If there are one winners
						var sub = bestScore[0];
					}
					else if (bestScore.length == 0) {
						// If there are no winners
						bestScore = subtitlesList;
					}
					else if (bestScore.length > 1) {
						// If there are several winners we take the last updated

						var last_updated_version = 0;
						var last_updated_version_i = 0;

						for (var i = 0; i < subtitlesList.length; ++i) {
							var s = subtitlesList[i];
							
							var s_link = s['link'].split('/');
							var updated_version = s_link[s_link.length-1];
							if (updated_version > last_updated_version){
								last_updated_version = updated_version;
								last_updated_version_i = i;
							}
						}

						var sub = subtitlesList[last_updated_version_i];
					}

					if (sub) {
						downloadSubs(sub);
					}
					else {
						setText("Oups, no subtitles match !");
					}
					

				}
				else if (subtitlesList.length > 0) {
					downloadSubs(subtitlesList[0]);
				}
				else {
					setText("Sorry, no subtitle found :(");
				}

				function downloadSubs(sub) {
					if (sub) {
						// Put sub next to the show with the same name and launch the show
						var folderPath = show.path.replace(show.filename, "");

						var regexExtension = /(.*)\.[^.]+$/;
						var subName = show.filename.match(regexExtension);

						addic7edApi.download(sub, folderPath+subName[1]+".srt").then(function () {
							setText("Subtitle downloaded ! Enjoy :)");
							// open show
							shell.openItem(show.path);
						});
					}
					else {
						setText("Oups, no subtitles !");
					}
				};
				
				$drop.removeClass('hover');
			});
		}
	};


	// POPCORN TIME SUBTITLE

	var pop_dl_in_progress = false;
	
	$('#settings-button').click(function(event) {
		event.preventDefault();
		sectionGo('settings');
	});

	$('#close-settings-button').click(function(event) {
		event.preventDefault();
		sectionGo('home');
	});

	$('#popcorn-time-yes').click(function(event) {
		event.preventDefault();
		$('.popcorntime-popover').hide();
		$('.popcorntime-popover-loader').show();
		popcorntimeDlSub();
	});

	function sectionGo(id) {
		var target = $('#section-'+id);
		if (target) {
			$('.section').removeClass('show');
			target.addClass('show');
		}
	}

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

	getRemoteSettings();	
	checkConnected(true);
	var popInterval = setInterval(function() {

		callPopcornApi("getviewstack");
	}, 1000);

	var currentShow = null;

	function popcorntimeDlSub() {
		if (currentShow !== null) {

			pop_dl_in_progress = true;

			var result = popParseTitle(currentShow);
			console.log(result);

			$('.pop-loader-title').text(result['title']+" season: "+result['season']+" episode: "+result['episode']);

			addic7edApi.search(result['title'], result['season'], result['episode'], subtitle_lang).then(function (subtitlesList) {
				
				//console.log(subtitlesList);

				var last_updated_version = 0;
				var last_updated_version_i = 0;

				for (var i = 0; i < subtitlesList.length; ++i) {
					var s = subtitlesList[i];
					//if (version_addicted.test(s['version'])) {
					var s_link = s['link'].split('/');
					var updated_version = s_link[s_link.length-1];
					if (updated_version > last_updated_version){
						last_updated_version = updated_version;
						last_updated_version_i = i;
					}
					//}
				}

				var sub = subtitlesList[last_updated_version_i];

				var filename = result['title'].replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.S'+result['season']+'E'+result['episode']+'.FRE.'+sub.version+'.srt';

				if (sub) {

					dialog.showOpenDialog({
					    title:"Select a folder",
					    properties: ["openDirectory"]
					},function (folderPaths) {

						$('.popcorntime-popover-loader').hide();
					    // folderPaths is an array that contains all the selected paths
					    if(folderPaths === undefined){
					        console.log("No destination folder selected");
					        pop_dl_in_progress = false;
					        return;
					    }else{
					        addic7edApi.download(sub, folderPaths[0]+'/'+filename).then(function () {
								setText('Subtitles file saved ! Enjoy :)');

								shell.showItemInFolder(folderPaths[0]+'/'+filename);

								pop_dl_in_progress = false;

							});
					    }
					});
					
				}
			});
		}
	}

	function popParseTitle(data) {
		var result = [];

		var input = data.result.title.split(' - ');

		result['title'] = input[0];
		result['caption'] = input[2];

		var regex = /([a-z]*)([0-9]+)/gi;
		if(regex.test(input[1])) {
			var find = input[1].match(regex);

			result['season'] = find[0];
			result['episode'] = find[1];
		}
		return result;
	}

	function showNotice() {
		if (!pop_dl_in_progress) {
			$('.popcorntime-popover').show();
		}
	}

	function popcorntimeNotifySub() {

		var checkShow = function(data) {
			var r = popParseTitle(data);
			console.log(r);
			if (r.season && r.episode) {
				currentShow = data;
				showNotice();
			}
		};

		callPopcornApi("getplaying", function(data) {
			if (data.result.title) {
				checkShow(data);
			}
			
		});

		callPopcornApi("getloading", function(data) {
			if (data.result.title) {
				checkShow(data);
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
					break;
				case 'main-browser':
					//mainBrowser(); 
					break;
				case 'movie-detail':
					//movieDetail();
					break;
				case 'player':
					//player();
					popcorntimeNotifySub();
				case 'notificationWrapper':
					//player();
					popcorntimeNotifySub();
				break;
				default:
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
		window.subtitle_lang = window.localStorage.getItem("lang");
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
					closeSettings();
					window.connected = true;
				}
				else { //there are errors
					if(warning){
						console.error("[ERROR] Invalid login credentials.");
						alert("Invalid login credetials provided.");
					}
					window.connected = false;
				}
			},
			error: function() {
				if(warning) {
					console.error("[ERROR] Could not connect to given client.");
					alert("Could not connect to Popcorn Time. Please check your settings.");
				}
				window.connected = false;
			}
		});
	}

});