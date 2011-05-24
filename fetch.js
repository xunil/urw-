var http = require('http');
var url = require('url');

var parsedUrl = url.parse('http://www.devrandom.net');
  var client = http.createClient(80, parsedUrl.hostname);

var request = client.request(parsedUrl.pathname, {'host': parsedUrl.hostname});
request.on('response', function(response) {
      console.log(response.headers);
});

request.end();
