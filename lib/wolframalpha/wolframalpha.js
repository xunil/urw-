/* ------------------------------ Includes && Options ----------------- */
var exec  = require('child_process').exec;

/* ------------------------------ WolframAlpha ------------------------ */
function WolframAlpha() {
  this.search = function(query, hollaback) {
    var result = {
      uri: "http://www.wolframalpha.com/input/?i=" + encodeURIComponent(query)
    };
    exec("curl -q '" + result.uri + "'", function (err, response, stderr) {
      var solution = />Solution:<[\s\S]*?alt\s*=\s*\"([^\""]*)\"/,
          other = /stringified"\s*:\s*"([^"\r\n]*)/g;

      if (solution.test(response)) {
        result.data = response.match(solution)[1];
      } else {
        match = response.match(other);
        if (!match) {
          result.data = null;
        } else {
          try {
            result.data = match[1].replace(/stringified"\s*:\s*"/g, '').replace(/\\n/g, ' ');
          } catch (e) {
            result.data = null;
          }
        }
      }
      hollaback.call(this, result);
    });
  };
}

/* ------------------------------ Export ------------------------------ */
module.exports = WolframAlpha;
