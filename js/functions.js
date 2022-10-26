
function createMap(map_div) {
	return new Promise(done => {
		require([
			"esri/map",
			"esri/layers/OpenStreetMapLayer",
			"dojo/domReady!"
		], function (Map, OpenStreetMapLayer) {
			var map, openStreetMapLayer;
			map = new Map(map_div, {
				center: [-82.452606, 27.964157],
				zoom: 12
			});
			var updateListener = map.on("update-end", function (err) {
				updateListener.remove();
				done(map);
			});
			openStreetMapLayer = new OpenStreetMapLayer();
			map.addLayer(openStreetMapLayer);
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
			"dojo/_base/Color",
			"esri/map",
			"esri/geometry/Point", 
			"esri/symbols/SimpleMarkerSymbol",
			"esri/geometry/Polyline", 
			"esri/symbols/SimpleLineSymbol",
			"esri/geometry/webMercatorUtils", 
			"esri/graphic", 
			"esri/layers/GraphicsLayer", 
			"esri/SpatialReference",
			"dojo/dom", 
			"dojo/dom-attr", 
			"esri/geometry/Extent",
			"dojo/domReady!"
		], function (Color, Map, Point, SimpleMarkerSymbol, Polyline, SimpleLineSymbol, webMercatorUtils, Graphic, GraphicsLayer, SpatialReference, dom, domAttr, Extent) {
			
			const PLAY_BTN = document.querySelector('#play-btn');
			PLAY_BTN.addEventListener('click', async function(e){
				e.preventDefault();
				await closeControls();
				var files = getFiles();
				var trpts = await parseFiles(files);
				
				var start = trpts.shift();
				var last_date = start.time;
				
				var spatial_reference = new SpatialReference({wkid: 4326});
				
				var start_pos = new Point(start.lng, start.lat, spatial_reference);
				
				
				var polyline_layer = new GraphicsLayer({id: "polyline"});
				var polyLine = new esri.geometry.Polyline(spatial_reference);
				var polyline_symbol = new SimpleLineSymbol();
				
				polyline_layer.add(new esri.Graphic(polyLine, polyline_symbol));
				map.graphics.add(polyline_layer);
				
				polyLine.addPath([start_pos]);
				
				map.on("update-end", function(){
					console.log("update");
				});

				
				for(var i=0; i<trpts.length; i++){
					console.log("extending");
					
					let point = trpts[i];
					let pos = new Point(point.lng, point.lat, spatial_reference);
					
					polyLine.insertPoint(0, i+1, pos);
							
					console.log(polyLine.paths);
							
					map.setExtent(polyLine.getExtent());
					
					polyline_layer.redraw();
					
					await new Promise(d=>setTimeout(d, 2500));
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