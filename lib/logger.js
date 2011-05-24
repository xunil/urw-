var sys = require("sys");

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

function timestamp() {
  var d = new Date();
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return [d.getDate(),
          months[d.getMonth()],
          [ pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds()),
            (d.getTime() + "").substr( - 4, 4)
           ].join(':')
         ].join(' ');
}

sys.log = exports.log = function log(data) {
  sys.puts(timestamp() + ' - ' + data.toString());
}

exports.timestamp = timestamp;