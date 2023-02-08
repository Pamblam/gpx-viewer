
/**
 * Creates and draws a map in the provided div
 * @param {HTMLElement} map_div
 * @returns {Promise} Resolves when the map is ready to use
 */
function createMap(map_div) {
	return new Promise(done => {
		require([
			"esri/map",
			"dojo/domReady!"
		], function (Map) {
			(async () => {
				var map = new Map(map_div, {
					center: [-82.452606, 27.964157],
					zoom: 12,
					basemap: "osm",
					slider: false
				});
				var updateListener = map.on("update-end", function (err) {
					updateListener.remove();
					done(map);
				});
			})();
		});
	});
}

/**
 * Slide the controls div out of the way
 * @returns {Promise} Resolves when the thing is closed
 */
function closeControls() {
	return new Promise(done => {
		const PIXELS_PER_FRAME = 7;
		const FRAME_BUFFER_MS = 1;
		const CONTROLS_DIV = document.querySelector('#controls_div');
		const HEADER = document.querySelector('#controls_div .header');
		const CHEVRON = document.querySelector('#controls_div .header span');
		const HEADER_HEIGHT = HEADER.getBoundingClientRect().height;

		var state = HEADER.dataset.state;
		if (state !== "opened") return done(false);
		CHEVRON.classList.add('alt');
		HEADER.dataset.state = "closing";

		var { top } = CONTROLS_DIV.getBoundingClientRect();
		var target_top = window.innerHeight - HEADER_HEIGHT;

		(function renderAnimationFrame() {
			top += PIXELS_PER_FRAME;
			if (top > target_top) top = target_top;

			CONTROLS_DIV.style.top = `${top}px`;
			if (top < target_top) {
				setTimeout(renderAnimationFrame, FRAME_BUFFER_MS);
			} else {
				HEADER.dataset.state = "closed";
				done();
			}
		})();
	});
}

/**
 * Opens the controls panel
 * @returns {Promise} Resolves when the animation is complete
 */
function openControls() {
	return new Promise(done => {
		const PIXELS_PER_FRAME = 7;
		const FRAME_BUFFER_MS = 1;
		const CONTROLS_DIV = document.querySelector('#controls_div');
		const HEADER = document.querySelector('#controls_div .header');
		const CHEVRON = document.querySelector('#controls_div .header span');
		const HEADER_HEIGHT = HEADER.getBoundingClientRect().height;

		var state = HEADER.dataset.state;
		if (state !== "closed") return done(false);
		CHEVRON.classList.remove('alt');
		HEADER.dataset.state = "opening";

		const BCR = CONTROLS_DIV.getBoundingClientRect();
		var top = BCR.top;
		var target_top = window.innerHeight - BCR.height - 10;

		(function renderAnimationFrame() {
			top -= PIXELS_PER_FRAME;
			if (top < target_top) top = target_top;

			CONTROLS_DIV.style.top = `${top}px`;
			if (top > target_top) {
				setTimeout(renderAnimationFrame, FRAME_BUFFER_MS);
			} else {
				HEADER.dataset.state = "opened";
				done();
			}
		})();
	});
}

/**
 * Adds an event listener to the header of the contols panel that 
 * allows user to open and close it via click
 * @returns {undefined}
 */
function initControlToggle() {
	const HEADER = document.querySelector('#controls_div .header');
	HEADER.addEventListener('click', function (e) {
		var state = this.dataset.state;
		if (state === "opened") {
			closeControls();
		} else if (state === "closed") {
			openControls();
		}
	});
}

/**
 * Init the drag and drop/ file import area
 * @param {Function} onAdd - A function that takes a set of files 
 * and adds them to the app's GPX_ROUTES 
 * @returns {undefined}
 */
function initFileControls({ onAdd }) {
	const FILE_DROP_DIV = document.querySelector('#file_drop');
	FI.addMimeType('gpx', 'application/gpx+xml');
	const fi = new FI({
		button: FILE_DROP_DIV,
		accept: ["gpx"],
		dragarea: FILE_DROP_DIV,
		dragenterclass: 'ddupload-hover',
		multi: true
	});
	fi.register_callback(function () {
		var files = fi.get_files();
		onAdd(files);
		fi.clear_files();
	});
}

/**
 * Renders the list of files in the control div
 * @param {Array} files An array of file/path objects
 * @param {Function} removeFile - A function that removes a file from GPX_ROUTES
 * @param {Function} rearrangeFiles - A function that rearranges a file in GPX_ROUTES
 * @param {Function} setFiles - A function that sets GPX_ROUTES
 * @returns {undefined}
 */
function renderFilesList({ files, removeFile, rearrangeFiles, setFiles }) {
	const FILE_LIST_DIV = document.querySelector("#files_list");

	var buffer = [];
	if (!files.length) {
		buffer.push(`<div class='file-item no-files'>No files to show.<br><a href='#' id='sample_files_button'>Load Sample Files?</a></div>`);
	} else {
		for (var i = 0; i < files.length; i++) {
			buffer.push(`<div class='file-item file-file' data-file-index='${i}'>
				<a href='#' data-file-index='${i}' class='remove-file'><i class="fa-solid fa-circle-minus"></i></a> 
				<span class='move-file'><i class="fa-solid fa-arrows-up-down"></i></span>
				<b>${i + 1}</b> - <i class="fa-solid fa-file-code"></i> ${files[i].title}</div>`);
		}
	}
	FILE_LIST_DIV.innerHTML = buffer.join('');
	document.querySelectorAll(".remove-file").forEach(btn => btn.addEventListener('click', function (e) {
		e.preventDefault();
		var idx = +this.dataset.fileIndex;
		removeFile(idx);
	}));
	new EZDnD_Group({
		element_selectors: '.file-file',
		anchor_selectors: '.file-file',
		container_selectors: '#files_list',
		placeholder: '<div>&rarr;</div>'
	});
	FILE_LIST_DIV.querySelectorAll('.file-file').forEach(ele => {
		ele.addEventListener('dnd-completed', function (e) {
			var from = +this.dataset.fileIndex;
			var to = [...FILE_LIST_DIV.querySelectorAll('.file-file')].indexOf(this);
			if (to !== from) rearrangeFiles(from, to);
		});
	});
	var load_files_btn = document.getElementById('sample_files_button');
	if (load_files_btn) {
		load_files_btn.addEventListener('click', async function (e) {
			e.preventDefault();
			var samplefiles = await loadSampleFiles();
			setFiles(samplefiles);
		});
	}
}

/**
 * Get the sample data from the server
 * @returns {Promise}
 */
function loadSampleFiles() {
	return new Promise(async done => {
		var sample_files = [
			'First_10_miles_of_the_Pinellas_Trail.gpx',
			'Miles_10_thru_27_5_of_the_Pinellas_Trail.gpx',
			'Miles_27_5_thru_41_25_of_the_Pinellas_Trail.gpx',
			'Southernmost_5_miles_of_the_Pinellas_Trail_North_Bay_Trail.gpx',
			'Southern_10_miles_of_the_Pinellas_Trail_South_Gap.gpx',
			'Last_piece_of_the_Pinellas_Trail_South_Gap.gpx',
			'Tiniest_piece_of_the_Pinellas_Trail_.gpx',
			'Last_piece_of_the_Pinellas_Trail.gpx'
		];
		var filesText = await Promise.all(sample_files.map(fn => fetch(`./gpx_sample_files/${fn}`).then(r => r.text())));
		var paths = await parseFiles(filesText);
		done(paths);
	});
}

/**
 * Play the animation
 * @param {Array} paths GPX_ROUTES
 * @param {Map} map
 * @param {Number} speed_multiplier
 * @returns {Promise} REsolves when animation is complete
 */
function playAnimation({ paths, map, speed_multiplier, display_div }) {
	return new Promise(async done => {
		var total_seconds = 0;
		var total_feet = 0;
		display_div.style.display = "block";

		for (var i = 0; i < paths.length; i++) {
			let [seconds, feet] = await renderPath({ path: paths[i], map, speed_multiplier, display_div, total_feet });
			total_seconds += seconds;
			total_feet += feet;
		}

		var total_miles = Math.floor((total_feet / 5280) * 100) / 100;
		var total_time = formatSeconds(total_seconds);
		var minutes_per_mile = Math.floor((5280 / (60 * (total_feet / total_seconds))) * 100) / 100;
		var avg_miles_per_run = Math.floor(((total_feet / 5280) / paths.length) * 100) / 100;

		var buffer = [`<table>`];
		buffer.push(`<tr><th>Total Miles:</th><td>${total_miles}</td></tr>`);
		buffer.push(`<tr><th>Total Runs:</th><td>${paths.length}</td></tr>`);
		buffer.push(`<tr><th>Total Run Time:</th><td>${total_time}</td></tr>`);
		buffer.push(`<tr><th>Avg Distance:</th><td>${avg_miles_per_run} Miles/Day</td></tr>`);
		buffer.push(`<tr><th>Avg Pace:</th><td>${minutes_per_mile} Mins/Mile</td></tr>`);
		buffer.push(`</table>`);
		
		display_div.innerHTML = buffer.join('');
		done();
	});
}

function formatSeconds(totalSeconds) {
	const totalMinutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}:${(''+minutes).padStart(2, '0')}:${(''+seconds).padStart(2, '0')}`;
}

/**
 * Render a single path
 * @param {Object} path a path from GPX_ROUTES
 * @param {type} map the Map instance to draw on
 * @param {Number} speed_multiplier 
 * @returns {Promise} Resolves when animation complete
 */
function renderPath({ path, map, speed_multiplier, display_div, total_feet }) {
	return new Promise(done => {
		require([
			"esri/map",
			"esri/graphic",
			"esri/symbols/SimpleFillSymbol",
			"esri/symbols/SimpleMarkerSymbol",
			"esri/symbols/SimpleLineSymbol",
			"esri/symbols/TextSymbol",
			"esri/symbols/Font",
			"esri/geometry/Circle",
			"esri/geometry/Polygon",
			"esri/geometry/Point",
			"esri/SpatialReference",
			"esri/geometry/webMercatorUtils",
			"esri/layers/GraphicsLayer",
			"dojo/request/script",
			"dojo/_base/array",
			"dojo/promise/all", "dojo/Deferred", "dojo/dom", "dojo/on", "dojo/json",
			"esri/symbols/PictureMarkerSymbol",
			"esri/symbols/CartographicLineSymbol",
			"esri/geometry/Polyline",
			"esri/Color",
			"dojo/dom-construct",
			"dojox/charting/Chart",
			"dojo/domReady!"
		], function (Map, Graphic, SimpleFillSymbol, SimpleMarkerSymbol, SimpleLineSymbol, TextSymbol, Font, Circle, Polygon, Point, SpatialReference, webMercatorUtils, GraphicsLayer, script, array, all, Deferred, dom, on, JSON, PictureMarkerSymbol, CartographicLineSymbol, Polyline, Color, domConstruct, Chart) {
			(async function (e) {

				var total_moving_time_seconds = 0;
				var total_distance_feet = 0;
				const displaySegment = segment => {
					if (segment && segment.length) {
						var feet = 0;
						for (var i = 1; i < segment.length; i++) {
							feet += getDistanceFromLatLonInFeet(segment[i].lat, segment[i].lng, segment[i - 1].lat, segment[i - 1].lng);
						}
						var seconds = (segment[segment.length - 1].time - segment[0].time) / 1000;
						var minutes_per_mile = Math.floor((5280 / (60 * (feet / seconds))) * 100) / 100;
						var date = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][segment[0].time.getMonth()]} ${segment[0].time.getDate()}, ${segment[0].time.getFullYear()}`
						var time = segment[0].time.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit"});

						var display_pace = `Walking`;
						if(minutes_per_mile < 15){
							total_moving_time_seconds += seconds;
							total_distance_feet += feet;
							display_pace = `${minutes_per_mile} Mins/Mile`;
						}

						var accumulative_feet = total_feet + total_distance_feet;
						var total_miles = Math.floor((accumulative_feet / 5280) * 100) / 100;
						
						var buffer = [`<table>`];
						buffer.push(`<tr><th>Date:</th><td>${date}</td></tr>`);
						buffer.push(`<tr><th>Time:</th><td>${time}</td></tr>`);
						buffer.push(`<tr><th>Pace:</th><td>${display_pace}</td></tr>`);
						buffer.push(`<tr><th>Distance:</th><td>${total_miles} Miles</td></tr>`);
						buffer.push(`</table>`);
						display_div.innerHTML = buffer.join('');
						
					}
				};

				var segmenter = getTimelapseSegmenter(path.path, speed_multiplier);
				segmenter.startTime();

				var lineGeometry;
				var gl = map.getLayer("runningtrack");

				if (!gl) {

					// The first time this is run the graphic layer won't exist, we'll need to create it

					gl = new GraphicsLayer({ id: "runningtrack" });
					map.addLayer(gl);

					var lineSymbol = new CartographicLineSymbol(
						CartographicLineSymbol.STYLE_SOLID,
						new Color([255, 0, 0]),
						3,
						CartographicLineSymbol.CAP_ROUND,
						CartographicLineSymbol.JOIN_ROUND,
						5
					);

					lineGeometry = new Polyline(new SpatialReference({ wkid: 4326 }));

					var segment = await segmenter.getNextSegment();
					displaySegment(segment);

					lineGeometry.addPath(segment.map(point => [point.lng, point.lat]));

					var lineGraphic = new Graphic(lineGeometry, lineSymbol);
					gl.add(lineGraphic);

					map.setExtent(lineGeometry.getExtent());

				} else {
					lineGeometry = gl.graphics[0].geometry;
					var segment = await segmenter.getNextSegment();
					displaySegment(segment);

					lineGeometry.addPath(segment.map(point => [point.lng, point.lat]));
				}

				while (true) {

					segment = await segmenter.getNextSegment();
					displaySegment(segment);

					if (segment === false) break;

					await new Promise(continue_loop => {

						var updateHandler = map.on("update-end", function () {
							updateHandler.remove();
							continue_loop();
						});

						for (var i = 0; i < segment.length; i++) {
							let pos = new Point({
								x: segment[i].lng,
								y: segment[i].lat,
								spatialReference: { wkid: 4326 }
							});
							lineGeometry.insertPoint(0, lineGeometry.paths[0].length, pos);
						}

						gl.redraw();
						map.setExtent(lineGeometry.getExtent().expand(3));
					});

				}

				done([total_moving_time_seconds, total_distance_feet]);
			})();
		});
	});
}

/**
 * Initiate the play button
 * @param {type} getPaths
 * @param {type} map
 * @param {type} speed_multiplier
 * @returns {undefined}
 */
function initPlayBtn({ getPaths, map, speed_multiplier, display_div }) {
	const PLAY_BTN = document.querySelector('#play-btn');
	PLAY_BTN.addEventListener('click', async function (e) {
		e.preventDefault();
		display_div.innerHTML = 'Loading...';
		await closeControls();
		var paths = getPaths();
		playAnimation({ paths, map, speed_multiplier, display_div });
	});
}

/**
 * Parse the File objects and get route objects
 * @param {Array} files GPX File text
 * @returns {Promise} Resolves with the parsed data
 */
async function parseFiles(filesText) {
	var paths = [];
	var total_dist = 0;
	for (var i = 0; i < filesText.length; i++) {
		let trackpoints = [];
		let gpx = (new DOMParser()).parseFromString(filesText[i], 'text/xml');
		let trkpts = gpx.getElementsByTagName("trkpt");
		var last_lat = false;
		var last_lng = false;

		for (var ii = 0; ii < trkpts.length; ii++) {
			let lat = parseFloat(trkpts[ii].getAttribute("lat"));
			let lng = parseFloat(trkpts[ii].getAttribute("lon"));
			let ele = parseFloat(trkpts[ii].getElementsByTagName("ele")[0].textContent);
			let time = new Date(trkpts[ii].getElementsByTagName("time")[0].textContent);

			let dist_feet = ii > 0 ? getDistanceFromLatLonInFeet(lat, lng, last_lat, last_lng) : 0;

			last_lat = lat;
			last_lng = lng;
			total_dist += dist_feet;
			trackpoints.push({
				lat,
				lng,
				ele,
				time,
				dist_feet: Math.floor(dist_feet * 100) / 100,
				total_miles: Math.floor(total_dist / 5280 * 100) / 100
			});

		}
		paths.push({
			title: gpx.getElementsByTagName("name")[0].textContent,
			path: trackpoints
		});
	}
	return paths;
}

function getDistanceFromLatLonInFeet(lat1, lon1, lat2, lon2) {
	const deg2rad = deg => deg * (Math.PI / 180);
	var R = 6371; // Radius of the earth in km
	var dLat = deg2rad(lat2 - lat1);  // deg2rad below
	var dLon = deg2rad(lon2 - lon1);
	var a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2)
		;
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c; // Distance in km
	return d * 3280.8398950131; // Distance in Feet
}

/**
 * Returns an object to iterate through the route in real, scaled time
 * @param {Array} points
 * @param {Number} speed_multiplier
 * @returns {Segmenter}
 */
function getTimelapseSegmenter(points, speed_multiplier) {

	var next_starting_index = 0;
	var current_real_time = null;
	var current_playback_time = null;

	var started = false;

	const startTime = () => {
		if (started) return;
		started = true;
		current_real_time = new Date();
		current_playback_time = new Date(points[0].time);
	};

	// must return a minimum of 2 points
	const getNextSegment = () => {
		return new Promise(done => {

			if (!started) startTime();

			// the -1 is to ensure that there is at least 2 points left to return
			if (next_starting_index >= points.length - 1) return done(false);

			let now = new Date();
			let real_elapsed_time = now.getTime() - current_real_time.getTime();
			let playback_elapsed_time = real_elapsed_time * speed_multiplier;
			current_playback_time.setTime(current_playback_time.getTime() + playback_elapsed_time);
			current_real_time = now;

			var segment = [];
			for (var i = next_starting_index; i < points.length; i++) {
				let point_time = new Date(points[i].time);
				if (point_time.getTime() <= current_playback_time.getTime()) {
					segment.push(points[i]);
					next_starting_index++;
				} else {
					break;
				}
			}

			// if there's only one left OR if there's only one in the current segment
			if (points.length === next_starting_index + 1 || segment.length === 1) {
				let next_point_time = new Date(points[next_starting_index].time);
				let playback_time_to_next_point = next_point_time.getTime() - current_playback_time.getTime();
				let real_time_to_next_point = playback_time_to_next_point / speed_multiplier;

				setTimeout(() => {
					current_real_time.setTime(current_real_time.getTime() + real_time_to_next_point);
					current_playback_time.setTime(current_playback_time.getTime() + playback_time_to_next_point);
					segment.push(points[next_starting_index]);
					next_starting_index++;
					done(segment);
				}, real_time_to_next_point);
			} else {
				done(segment);
			}



		});
	};


	return {
		getNextSegment,
		startTime,
		getPlaybackTime: () => current_playback_time,
	};
}