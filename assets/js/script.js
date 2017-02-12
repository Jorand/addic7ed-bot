// Dependencies
var addic7edApi = require('addic7ed-api');
var remote = require('electron').remote;
var dialog = remote.dialog;
var shell = remote.shell;

// Settings
var subtitle_lang = "fre";


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

	var getSub = function(show) {
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

});