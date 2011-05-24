/* ------------------------------ Includes && Options ------------------------------ */
var exec  = require('child_process').exec;

/* ------------------------------ Google ------------------------------ */
function Google() {
  this.search = function(query, hollaback) {
    exec('curl -q "http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=' + escape(query) + '"', function (err, response, stderr) {
      console.log(response);
      var results = JSON.parse(response)['responseData']['results'];
      results.forEach(function(x) {
        x.titleNoFormatting = x.titleNoFormatting.replace(/&#([^\s]*);/g, function(m1, m2) {
          return String.fromCharCode(m2);
        }).replace(/&(nbsp|amp|quot|lt|gt);/g, function(m1, m2) {
          return { 'nbsp': ' ', 'amp': '&', 'quot': '"', 'lt': '<', 'gt': '>' }[m2];
        });
        return x;
      });
      hollaback.call(this, results);
    });
  };
}

/* ------------------------------ Export ------------------------------ */
module.exports = Google;
