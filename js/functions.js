

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

function initPlayBtn({getFiles, map, speed_multiplier}){
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
				
			const PLAY_BTN = document.querySelector('#play-btn');
			PLAY_BTN.addEventListener('click', async function(e){
				e.preventDefault();
				await closeControls();
				var files = getFiles();
				var points = await parseFiles(files);
				
				var gl = new GraphicsLayer({id: "runningtrack"});
				map.addLayer(gl);

				var lineSymbol = new CartographicLineSymbol(
						CartographicLineSymbol.STYLE_SOLID, 
						new Color([255,0,0]), 
						10, 
						CartographicLineSymbol.CAP_ROUND, 
						CartographicLineSymbol.JOIN_MITER, 
						5
				);

				var lineGeometry = new Polyline(new SpatialReference({wkid:4326}));
				lineGeometry.addPath([
					[points[0].lng, points[0].lat],
					[points[1].lng, points[1].lat]
				]);

				var lineGraphic = new Graphic(lineGeometry, lineSymbol);
				gl.add(lineGraphic)

				map.setExtent(lineGeometry.getExtent());
					
					
				for(var i=2; i<points.length; i++){

					//await new Promise(d=>setTimeout(d, 100));

					await new Promise(continue_loop=>{

						var updateHandler = map.on("update-end", function(){
							updateHandler.remove();
							continue_loop();
						});

						let point = [points[i].lng, points[i].lat];

						let pos = new Point({
							x: point[0], 
							y: point[1], 
							spatialReference: {wkid:4326} 
						});

						lineGeometry.insertPoint(0, i, pos);
						gl.redraw();

						map.setExtent(lineGeometry.getExtent().expand(3));

					});

				}
				
			});
			
		});
	});
}

async function parseFiles(files){
	var trackpoints = [];
	let filesText = await Promise.all(files.map(FI.get_file_text));
	for(var i=0; i<filesText.length; i++){
		let gpx = (new DOMParser()).parseFromString(filesText[i], 'text/xml');
		let trkpts = gpx.getElementsByTagName("trkpt");
		for (var ii=0; ii<trkpts.length; ii++) {
			let lat = parseFloat(trkpts[ii].getAttribute("lat"));
			let lng = parseFloat(trkpts[ii].getAttribute("lon"));
			let ele = parseFloat(trkpts[ii].getElementsByTagName("ele")[0].textContent);
			let time = new Date(trkpts[ii].getElementsByTagName("time")[0].textContent);
			trackpoints.push({lat, lng, ele, time});
		}
	}
	return trackpoints;
}