var multi_level = (function() {


function goTo(level) {
	beo.showDeepMenu("multi-level-test-l"+level);
}


return {
	goTo: goTo
};

})();