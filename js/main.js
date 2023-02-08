(async function main(){
	
	const SPEED_MULTIPLIER = 300;
	
	const MAP_DIV = document.querySelector("#main_map");
	const MAIN_MAP = await createMap(MAP_DIV);
	const DISPLAY_DIV = document.querySelector('#display_area');
	
	const GPX_ROUTES = [];
	
	const renderFiles = () => renderFilesList({
		files: GPX_ROUTES,
		removeFile: idx => {
			GPX_ROUTES.splice(idx, 1);
			renderFiles();
		},
		rearrangeFiles(from, to){
			var file = GPX_ROUTES.splice(from, 1)[0];
			GPX_ROUTES.splice(to, 0, file);
			renderFiles();
		},
		setFiles(files){
			while(GPX_ROUTES.length) GPX_ROUTES.pop();
			GPX_ROUTES.push(...files);
			renderFiles();
		}
	});
	
	initControlToggle();
	
	initPlayBtn({
		getPaths(){ return GPX_ROUTES; },
		speed_multiplier: SPEED_MULTIPLIER,
		map: MAIN_MAP,
		display_div: DISPLAY_DIV
	});
	
	renderFiles();
	
	initFileControls({
		async onAdd(files){
			var filesText = await Promise.all(files.map(FI.get_file_text));
			var routes = await parseFiles(filesText);
			GPX_ROUTES.push(...routes);
			renderFiles();
		}
	});
	
})();