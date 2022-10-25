
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
	
	// Clone the node to remove the event listeners on it
	
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
		anchor_selectors: '.move-file', 
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