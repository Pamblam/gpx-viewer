(async function main(){
	
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
	
	renderFiles();
	
	initFileControls(files=>{
		GPX_FILES.push(...files);
		renderFiles();
	});
	
})();