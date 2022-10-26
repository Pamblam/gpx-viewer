

function createMap(map_div) {
	return new Promise(done => {
		require([
			"esri/map",
			"dojo/domReady!"
		], function (Map) {
			(async ()=>{
				var map = new Map(map_div, {
					center: [-82.452606, 27.964157],
					zoom: 12,
					basemap: "osm"
				});
				var updateListener = map.on("update-end", function (err) {
					updateListener.remove();
					done(map);
				});
			})();
		});
	});
}

function closeControls(){
	return new Promise(done=>{
		const PIXELS_PER_FRAME = 7;
		const FRAME_BUFFER_MS = 1;
		const CONTROLS_DIV = document.querySelector('#controls_div');
		const HEADER = document.querySelector('#controls_div .header');
		const CHEVRON = document.querySelector('#controls_div .header span');
		const HEADER_HEIGHT = HEADER.getBoundingClientRect().height;
		
		var state = HEADER.dataset.state;
		if(state !== "opened") return done(false);
		CHEVRON.classList.add('alt');
		HEADER.dataset.state = "closing";
		
		var {top} = CONTROLS_DIV.getBoundingClientRect();
		var target_top = window.innerHeight - HEADER_HEIGHT;
		
		(function renderAnimationFrame(){
			top += PIXELS_PER_FRAME;
			if(top > target_top) top = target_top;
			
			CONTROLS_DIV.style.top = `${top}px`;
			if(top < target_top){
				setTimeout(renderAnimationFrame, FRAME_BUFFER_MS);
			}else{
				HEADER.dataset.state = "closed";
				done();
			}
		})();
	});
}

function openControls(){
	return new Promise(done=>{
		const PIXELS_PER_FRAME = 7;
		const FRAME_BUFFER_MS = 1;
		const CONTROLS_DIV = document.querySelector('#controls_div');
		const HEADER = document.querySelector('#controls_div .header');
		const CHEVRON = document.querySelector('#controls_div .header span');
		const HEADER_HEIGHT = HEADER.getBoundingClientRect().height;
		
		var state = HEADER.dataset.state;
		if(state !== "closed") return done(false);
		CHEVRON.classList.remove('alt');
		HEADER.dataset.state = "opening";
		
		const BCR = CONTROLS_DIV.getBoundingClientRect();
		var top = BCR.top;
		var target_top = window.innerHeight - BCR.height - 10;
		
		(function renderAnimationFrame(){
			top -= PIXELS_PER_FRAME;
			if(top < target_top) top = target_top;
			
			CONTROLS_DIV.style.top = `${top}px`;
			if(top > target_top){
				setTimeout(renderAnimationFrame, FRAME_BUFFER_MS);
			}else{
				HEADER.dataset.state = "opened";
				done();
			}
		})();
	});
}

function initControlToggle(){
	const HEADER = document.querySelector('#controls_div .header');
	HEADER.addEventListener('click', function(e){
		var state = this.dataset.state;
		if(state === "opened"){
			closeControls();
		}else if(state === "closed"){
			openControls();
		}
	});
}

function initFileControls(onAdd){
	const FILE_DROP_DIV = document.querySelector('#file_drop');
	FI.addMimeType('gpx', 'application/gpx+xml');
	const fi = new FI({
		button: FILE_DROP_DIV,
		accept: ["gpx"],
		dragarea: FILE_DROP_DIV,
		dragenterclass: 'ddupload-hover',
		multi: true
	});
	fi.register_callback(function(){
		var files = fi.get_files();
		onAdd(files);
		fi.clear_files();
	});
}

function renderFilesList({files, removeFile, rearrangeFiles}){
	const FILE_LIST_DIV = document.querySelector("#files_list");
	
	var buffer = [];
	if(!files.length){
		buffer.push(`<div class='file-item no-files'>No files to show.</div>`);
	}else{
		for(var i=0; i<files.length; i++){
			buffer.push(`<div class='file-item file-file' data-file-index='${i}'>
				<a href='#' data-file-index='${i}' class='remove-file'><i class="fa-solid fa-circle-minus"></i></a> 
				<span class='move-file'><i class="fa-solid fa-arrows-up-down"></i></span>
				<b>${i+1}</b> - <i class="fa-solid fa-file-code"></i> ${files[i].name}</div>`);
		}
	}
	FILE_LIST_DIV.innerHTML = buffer.join('');
	document.querySelectorAll(".remove-file").forEach(btn=>btn.addEventListener('click', function(e){
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
	FILE_LIST_DIV.querySelectorAll('.file-file').forEach(ele=>{
		ele.addEventListener('dnd-completed', function(e){
			var from = +this.dataset.fileIndex;
			var to = [...FILE_LIST_DIV.querySelectorAll('.file-file')].indexOf(this);
			if(to !== from) rearrangeFiles(from, to);
		});
	});
}

function playAnimation({paths, map, speed_multiplier}){
	return new Promise(async done => {
		for(var i=0; i<paths.length; i++){
			await renderPath({index: i, path: paths[i], map, speed_multiplier});
		}
		done();
	});
}

function renderPath({index, path, map, speed_multiplier}){
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
			(async function(e){
				
				console.log(speed_multiplier);
				
				var segmenter = getTimelapseSegmenter(path, speed_multiplier);
				segmenter.startTime();
				
				var gl = new GraphicsLayer({id: "runningtrack"+index});
				map.addLayer(gl);

				var lineSymbol = new CartographicLineSymbol(
						CartographicLineSymbol.STYLE_SOLID, 
						new Color([255,0,0]), 
						3, 
						CartographicLineSymbol.CAP_ROUND, 
						CartographicLineSymbol.JOIN_MITER, 
						5
				);

				var lineGeometry = new Polyline(new SpatialReference({wkid:4326}));
				
				var segment = await segmenter.getNextSegment();
				lineGeometry.addPath(segment.map(point=>[point.lng, point.lat]));

				var lineGraphic = new Graphic(lineGeometry, lineSymbol);
				gl.add(lineGraphic)

				map.setExtent(lineGeometry.getExtent());
					
					
				while(true){
					
					segment = await segmenter.getNextSegment();
					if(segment === false) break;

					await new Promise(continue_loop=>{

						var updateHandler = map.on("update-end", function(){
							updateHandler.remove();
							continue_loop();
						});

						for(var i=0; i<segment.length; i++){
							let pos = new Point({
								x: segment[i].lng, 
								y: segment[i].lat, 
								spatialReference: {wkid:4326} 
							});
							lineGeometry.insertPoint(0, i, pos);
						}
							
						gl.redraw();
						map.setExtent(lineGeometry.getExtent().expand(3));
					});

				}
				
				done();
			})();
		});
	});
}

function initPlayBtn({getFiles, map, speed_multiplier}){
	const PLAY_BTN = document.querySelector('#play-btn');
	PLAY_BTN.addEventListener('click', async function(e){
		e.preventDefault();
		await closeControls();
		var files = getFiles();
		var paths = await parseFiles(files);
		playAnimation({paths, map, speed_multiplier});
	});
}

async function parseFiles(files){
	var paths = [];
	let filesText = await Promise.all(files.map(FI.get_file_text));
	for(var i=0; i<filesText.length; i++){
		let trackpoints = [];
		let gpx = (new DOMParser()).parseFromString(filesText[i], 'text/xml');
		let trkpts = gpx.getElementsByTagName("trkpt");
		for (var ii=0; ii<trkpts.length; ii++) {
			let lat = parseFloat(trkpts[ii].getAttribute("lat"));
			let lng = parseFloat(trkpts[ii].getAttribute("lon"));
			let ele = parseFloat(trkpts[ii].getElementsByTagName("ele")[0].textContent);
			let time = new Date(trkpts[ii].getElementsByTagName("time")[0].textContent);
			trackpoints.push({lat, lng, ele, time});
		}
		paths.push(trackpoints);
	}
	return paths;
}

function getTimelapseSegmenter(points, speed_multiplier){

	var next_starting_index = 0;
	var current_real_time = null;
	var current_playback_time = null;

	var started = false;

	const startTime = () => {
		if(started) return;
		started = true;
		current_real_time = new Date();
		current_playback_time = new Date(points[0].time);
	};

	// must return a minimum of 2 points
	const getNextSegment = ()=>{
		return new Promise(done=>{
			
			if(!started) startTime();
			
			// the -1 is to ensure that there is at least 2 points left to return
			if(next_starting_index >= points.length-1) return done(false); 

			let now = new Date();
			let real_elapsed_time = now.getTime() - current_real_time.getTime();
			let playback_elapsed_time = real_elapsed_time * speed_multiplier;
			current_playback_time.setTime(current_playback_time.getTime()+playback_elapsed_time);
			current_real_time = now;

			var segment = [];
			for(var i=next_starting_index; i<points.length; i++){
				let point_time = new Date(points[i].time);
				if(point_time.getTime() <= current_playback_time.getTime()){
					segment.push(points[i]);
					next_starting_index++;
				}else{
					break;
				}
			}
			
			// if there's only one left OR if there's only one in the current segment
			if(points.length === next_starting_index + 1 || segment.length === 1){
				let next_point_time = new Date(points[next_starting_index].time);
				let playback_time_to_next_point = next_point_time.getTime() - current_playback_time.getTime();
				let real_time_to_next_point = playback_time_to_next_point / speed_multiplier;
				
				setTimeout(()=>{
					current_real_time.setTime(current_real_time.getTime()+real_time_to_next_point);
					current_playback_time.setTime(current_playback_time.getTime()+playback_time_to_next_point);
					segment.push(points[next_starting_index]);
					next_starting_index++;
					done(segment);
				}, real_time_to_next_point);
			}else{
				done(segment);
			}
			
			
			
		});
	};


	return {
		getNextSegment,
		startTime,
		getPlaybackTime: ()=>current_playback_time,
	};
}