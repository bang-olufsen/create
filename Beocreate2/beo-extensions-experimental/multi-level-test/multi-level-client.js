var multi_level = (function() {


function goTo(level) {
	showDeepMenu("multi-level-test-l"+level);
}


return {
	goTo: goTo
};

})();