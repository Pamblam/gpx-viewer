(async function main(){
	
	const SPEED_MULTIPLIER = 300;
	
	const MAP_DIV = document.querySelector("#main_map");
	const MAIN_MAP = await createMap(MAP_DIV);
	
	const GPX_FILES = [];
	
	const renderFiles = () => renderFilesList({
		files: GPX_FILES,
		removeFile: idx => {
			GPX_FILES.splice(idx, 1);
			renderFiles();
		},
		rearrangeFiles(from, to){
			var file = GPX_FILES.splice(from, 1)[0];
			GPX_FILES.splice(to, 0, file);
			renderFiles();
		}
	});
	
	initControlToggle();
	
	initPlayBtn({
		getFiles(){
			return GPX_FILES;
		},
		speed_multiplier: SPEED_MULTIPLIER,
		map: MAIN_MAP
	});
	
	renderFiles();
	
	initFileControls(files=>{
		GPX_FILES.push(...files);
		renderFiles();
	});
	
})();