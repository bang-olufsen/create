var mdns = require('multicast-dns')();

mdns.on('response', function (response) {
	console.log(response);
});
setTimeout(function() {
	mdns.query({ questions:[{ name: 'Beocreate-4-Encore.local', type: 'A' }] });
}, 1000);
