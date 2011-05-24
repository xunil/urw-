#!/usr/bin/env node

/* ------------------------------ Includes && Options ------------------------------ */

require.paths.unshift(__dirname + '/lib');
require.paths.unshift(__dirname);

var sys = require('sys'),
    fs = require('fs'),
    url = require('url'),
    http = require('http'),
    io = require('./lib/socket.io-client/io-client').io,
    querystring = require('querystring'),
    path = require('path'),
    exec = require('child_process').exec,
    log = require('logger'),
    xml2js = require('./lib/node-xml2js/lib/xml2js'),
    jerk = require('./lib/Jerk/lib/jerk'),
    Sandbox = require('./lib/sandbox/lib/sandbox'),
    Google = require('./lib/google/google'),
    WolframAlpha = require('./lib/wolframalpha/wolframalpha');


// Sandbox
var sandbox = new Sandbox();

// Google
var google = new Google();

// WolframAlpha
var wa = new WolframAlpha();

// blacklisted users
var blacklist = ["Kha0S", "Xunil"];

// give arrays a .has() method
Array.prototype.has = function (value) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === value) return true;
    }
    return false;
};


/* ----------------------------- Read Configuration ---------------------------- */

try {
  var configJSON = fs.readFileSync(__dirname + '/config.json');
  var config = JSON.parse(configJSON.toString());
} catch (e) {
  sys.puts('File config.json not found or is invalid.  Try: `cp config.json.sample config.json`');
  process.exit(1);
}

/* ---------------------------- Socket.IO Connection --------------------------- */

if (config.listen_port) {
  // Socket IO Client Connection
  var socket = new io.Socket('localhost', {'port': config.listen_port});

  socket.on('connect', function() {
    socket.send('#linuxos connected');
  });

  socket.on('message', function(msg) {
    log.log('received: ' + JSON.stringify(msg));
  });

  socket.connect();
}

/* ------------------------------ Webserver ------------------------------ */

httpServer = http.createServer(function(req, res){
  var path = url.parse(req.url).pathname;
  log.log("HTTP: inbound request: " + path);
  switch (path){
    case '/':
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write('<html><head></head></html>');
      res.end();
      break;

    default: send404(res);
  }
}),

send404 = function(res) {
  res.writeHead(404);
  res.write('404');
  res.end();
};

// Fire up the WebSocket Server
httpServer.listen(config.listen_port);


/* ------------------------------ Simple Commands ------------------------------ */

var commands = {
  'about': 'http://devrandom.net'
};

for (var c in commands) {
  jerk(function(j) {
    var cmd = commands[c];
    j.watch_for(new RegExp('^!' + c + '(?:\\s*@\\s*([-\\[\\]\\{\\}`|_\\w]+))?\\s*$', 'i' ), function(message) {
      message.say(to(message) + ': ' + cmd);
    });
  });
}

/* ------------------------------------ bot ------------------------------------ */

jerk(function(j) {
  // Sandbox
  j.watch_for(/^!eval (.+)/, function(message) {
    sandbox.run(message.match_data[1], function(output) {
      var original_length;
      output = output.result.replace(/\n/g, ' ');
      if ((original_length = output.length) > (1024 - message.user.length - 3)) {
        output = output.slice(0, 768) + '  (' + (original_length - 768) + ' characters truncated)';
      }
      message.say(message.user + ': ' + output);
    });
  });

  // Google
  j.watch_for(/^!g ([^#@]+)(?:\s*#([1-9]))?(?:\s*@\s*([-\[\]\{\}`|_\w]+))?$/, function(message) {
    var user = to(message, 3),
         res = +message.match_data[2] - 1 || 0;

    if (!blacklist.has(user)) {
      try {
        google.search(message.match_data[1], function(results) {
          if (results.length) {
            message.say(user + ': ' + results[res].titleNoFormatting + ' - ' + results[res].unescapedUrl);
          } else {
            message.say(user + ': Sorry, no results for `' + message.match_data[1] + '`');
          }
        });
      } catch (e) {
        message.say(user + ': Sorry, no results for `' + message.match_data[1] + '`');
      }
    }
  });

  // Wolfram Alpha
  j.watch_for(/^!calc ([^@]+)(?:\s*@\s*([-\[\]\{\}`|_\w]+))?/, function(message) {
    var user = to(message, 2);
    if (!blacklist.has(user)) {
      try {
        wa.search(message.match_data[1], function(result) {
          message.say(html_entity_decode(user + ': ' + (result && result.data ? result.data : 'Sorry, no results for `' + message.match_data[1] + '`')));
        });
      } catch (e) {
        message.say(user + ': Sorry, no results for `' + message.match_data[1] + '`');
      }
    }
  });

  // Stock Ticker
  j.watch_for(/^!(q|quote|ticker) ([^@]+)(?:\s*@\s*([-\[\]\{\}`|_\w]+))?/, function(message) {
    var user = to(message, 3);
    if (!blacklist.has(user)) {
      try {
        var uri = 'http://download.finance.yahoo.com/d/quotes.csv?&f=sl1d1t1c1ohgv&e=.csv&s=' + escape(message.match_data[2]);
        exec('curl --user-agent "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)" -q \'' + uri + '\'', function(err, response, stderr) {
          i = response.replace(/"/g, '').split(',');
          if (i[2] != 'N/A') {
            msg = i[0] + ': ' +
                  i[1] + ' | ' +
                  i[2] + ' - ' +
                  i[3] + ' | change ' +
                  i[4] + ' | open ' +
                  i[5] + ' | low ' +
                  i[7] + ' | high ' +
                  i[6] + ' | volume ' +
                  i[8];
            message.say(html_entity_decode(msg));
          } else {
            message.say(user + ': Sorry, unable to lookup: \'' + message.match_data[2] + '\'');
          }
        });
      } catch (e) {
      }
    }
  });

  // Weather
  j.watch_for(/^!weather ([^@]+)(?:\s*@\s*([-\[\]\{\}`|_\w]+))?/, function(message) {
    var user = to(message, 2);
    if (!blacklist.has(user)) {
      try {
        var uri = 'http://api.wunderground.com/auto/wui/geo/WXCurrentObXML/index.xml?query=' + escape(message.match_data[1]);
        exec('curl --user-agent "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)" -q \'' + uri + '\'', function(err, response, stderr) {
          var parser = new xml2js.Parser();
          parser.addListener('end', function(result) {
            if (result['display_location']['full'] != ',') {
              msg = result['display_location']['full'] + ' | ' +
                    result['weather'] + ' | ' +
                    result['temp_f'] + '°F/' + result['temp_c'] + '°C | Humidity ' +
                    result['relative_humidity'] + ' | Wind ' +
                    result['wind_mph'] + 'mph ' + result['wind_dir'] + ' | ' +
                    result['forecast_url'];
              message.say(html_entity_decode(msg));
            } else {
              message.say(user + ': Sorry, unable to lookup: \'' + message.match_data[1] + '\'');
            }
          });
          parser.parseString(response);
        });
      } catch (e) {
      }
    }
  });

  // URL Processing (del.icio.us)
  j.watch_for(/(http|https)\:\/\/(.+)($|\ )/, function(message) {
    var user = to(message, 3);

    if (!blacklist.has(user)) {
      if (user != config.nick) {
        // this should probably be using a real html parser, but meh
        var uri = message.match_data[1] + '://' + message.match_data[2];
        try {
          // use curl here, node-get can cause a dns crash if someone pastes a bad url :/
          exec('curl -L --user-agent "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)" -q \'' + uri + '\'', function(err, response, stderr) {
            if (response.length !== 0) {
              var title;
              try {
                title = decodeSpecial(html_entity_decode(response.replace(/\n/g, '').replace(/\s+/g, ' ').match(/\<title\>(.*?)\<\/title\>/i)[1].slice(0, 75)));
                if (title.toLowerCase() == 'bad request') {
                  title = '';
                }
              } catch (e) {
                title = '';
              }
              if (title !== uri && title !== '') {
                message.say('[' + title + ']');
              }
              // little hack to make the post to scuttle work even if there is no title
              if (title == '') {
                title = uri;
              }
            }
            if (config.delicious && title !== '') {
              var qs = querystring.stringify({ 'tags': 'irc',
                                               'description' : title,
                                               'url': message.match_data[1] + '://' + message.match_data[2]
                                             });
              exec('curl --user-agent "Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)" -q \'' + config.delicious + qs + '\'', function(err, stdout, stderr) { });
            }
          });
        } catch (e) {
        }
      }
    }
  });

  // LOGS
  j.watch_for(/(.*)/, function(message) {
    var channel = message.source.toLowerCase(),
        user = message.user,
        text = message.text[0],
        now = new Date(),
        year = now.getFullYear(),
        month = (tmp = now.getMonth() + 1) < 10 ? '0' + tmp : tmp,
        day = (tmp = now.getDate()) < 10 ? '0' + tmp : tmp,
        hour = (tmp = now.getHours()) < 10 ? '0' + tmp : tmp,
        minute = (tmp = now.getMinutes()) < 10 ? '0' + tmp : tmp,
        basefolder = [process.cwd(), config.logfolder].join(''),
        folder = [process.cwd(), config.logfolder, channel, '/'].join(''),
        filename = [folder, year, '-', month, '-', day, '.log'].join(''),
        str = ['[', hour, ':', minute, '] ', user, ': ', text, "\n"].join('');


      if (config.listen_port && socket.open) {
        socket.send(['[', hour, ':', minute, '] ', '<', user, '> ', text, "\n"].join(''));
      }

      // Make the directory
      path.exists(basefolder, function(exists) {
        if (!exists) {
          fs.mkdirSync(basefolder, 488);
        } else {
          path.exists(folder, function(exists) {
            if (!exists) {
              fs.mkdirSync(folder, 488);
            } else {
              var file;
              try {
                file = fs.createWriteStream(filename, {'flags': 'a+'});
              } catch(e) {
                file = fs.createWriteStream(filename, {'flags': 'w', 'mode': 0644});
              }
              file.write(str);
              file.end();
            }
          });
        }
      });
  });

/* --------------------------------- Functions --------------------------------- */

function to(message, def, idx) {
  if (typeof idx === 'undefined' && typeof def === 'number') {
    idx = def
    def = null;
  } else {
    idx = idx || 1;
  }
  return !!message.match_data[idx] ? message.match_data[idx] : def || message.user;
}
}).connect(config);


// decode all the fancy new HTML4 special chars
function decodeSpecial(text) {
  var numeric = Array('&#8704;', '&#8706;', '&#8707;', '&#8709;', '&#8711;', '&#8712;', '&#8713;', '&#8715;', '&#8719;', '&#8721;', '&#8722;', '&#8727;', '&#8730;', '&#8733;', '&#8734;', '&#8736;', '&#8743;', '&#8744;', '&#8745;', '&#8746;', '&#8747;', '&#8756;', '&#8764;', '&#8773;', '&#8776;', '&#8800;', '&#8801;', '&#8804;', '&#8805;', '&#8834;', '&#8835;', '&#8836;', '&#8838;', '&#8839;', '&#8853;', '&#8855;', '&#8869;', '&#8901;', '&#913;', '&#914;', '&#915;', '&#916;', '&#917;', '&#918;', '&#919;', '&#920;', '&#921;', '&#922;', '&#923;', '&#924;', '&#925;', '&#926;', '&#927;', '&#928;', '&#929;', '&#931;', '&#932;', '&#933;', '&#934;', '&#935;', '&#936;', '&#937;', '&#945;', '&#946;', '&#947;', '&#948;', '&#949;', '&#950;', '&#951;', '&#952;', '&#953;', '&#954;', '&#955;', '&#956;', '&#957;', '&#958;', '&#959;', '&#960;', '&#961;', '&#962;', '&#963;', '&#964;', '&#965;', '&#966;', '&#967;', '&#968;', '&#969;', '&#977;', '&#978;', '&#982;', '&#338;', '&#339;', '&#352;', '&#353;', '&#376;', '&#402;', '&#710;', '&#732;', ' ', '&#8195;', '&#8201;', '&#8211;', '&#8212;', '&#8216;', '&#8217;', '&#8218;', '&#8220;', '&#8221;', '&#8222;', '&#8224;', '&#8225;', '&#8226;', '&#8230;', '&#8240;', '&#8242;', '&#8243;', '&#8249;', '&#8250;', '&#8254;', '&#8364;', '&#8482;', '&#8592;', '&#8593;', '&#8594;', '&#8595;', '&#8596;', '&#8629;', '&#8968;', '&#8969;', '&#8970;', '&#8971;', '&#9674;', '&#9824;', '&#9827;', '&#9829;', '&#9830;');
  var name = Array('&forall;', '&part;', '&exist;', '&empty;', '&nabla;', '&isin;', '&notin;', '&ni;', '&prod;', '&sum;', '&minus;', '&lowast;', '&radic;', '&prop;', '&infin;', '&ang;', '&and;', '&or;', '&cap;', '&cup;', '&int;', '&there4;', '&sim;', '&cong;', '&asymp;', '&ne;', '&equiv;', '&le;', '&ge;', '&sub;', '&sup;', '&nsub;', '&sube;', '&supe;', '&oplus;', '&otimes;', '&perp;', '&sdot;', '&Alpha;', '&Beta;', '&Gamma;', '&Delta;', '&Epsilon;', '&Zeta;', '&Eta;', '&Theta;', '&Iota;', '&Kappa;', '&Lambda;', '&Mu;', '&Nu;', '&Xi;', '&Omicron;', '&Pi;', '&Rho;', '&Sigma;', '&Tau;', '&Upsilon;', '&Phi;', '&Chi;', '&Psi;', '&Omega;', '&alpha;', '&beta;', '&gamma;', '&delta;', '&epsilon;', '&zeta;', '&eta;', '&theta;', '&iota;', '&kappa;', '&lambda;', '&mu;', '&nu;', '&xi;', '&omicron;', '&pi;', '&rho;', '&sigmaf;', '&sigma;', '&tau;', '&upsilon;', '&phi;', '&chi;', '&psi;', '&omega;', '&thetasym;', '&upsih;', '&piv;', '&OElig;', '&oelig;', '&Scaron;', '&scaron;', '&Yuml;', '&fnof;', '&circ;', '&tilde;', '&#8194;', '&emsp;', '&thinsp;', '&ndash;', '&mdash;', '&lsquo;', '&rsquo;', '&sbquo;', '&ldquo;', '&rdquo;', '&bdquo;', '&dagger;', '&Dagger;', '&bull;', '&hellip;', '&permil;', '&prime;', '&Prime;', '&lsaquo;', '&rsaquo;', '&oline;', '&euro;', '&trade;', '&larr;', '&uarr;', '&rarr;', '&darr;', '&harr;', '&crarr;', '&lceil;', '&rceil;', '&lfloor;', '&rfloor;', '&loz;', '&spades;', '&clubs;', '&hearts;', '&diams;');
  var plain = Array('∀', '∂', '∃', '∅', '∇', '∈', '∉', '∋', '∏', '∑', '−', '∗', '√', '∝', '∞', '∠', '∧', '∨', '∩', '∪', '∫', '∴', '∼', '≅', '≈', '≠', '≡', '≤', '≥', '⊂', '⊃', '⊄', '⊆', '⊇', '⊕', '⊗', '⊥', '⋅', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω', 'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'ς', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'ϑ', 'ϒ', 'ϖ', 'Œ', 'œ', 'Š', 'š', 'Ÿ', 'ƒ', 'ˆ', '˜', ' ', ' ', ' ', '–', '—', '‘', '’', '‚', '“', '”', '„', '†', '‡', '•', '…', '‰', '′', '″', '‹', '›', '‾', '€', '™', '←', '↑', '→', '↓', '↔', '↵', '⌈', '⌉', '⌊', '⌋', '◊', '♠', '♣', '♥', '♦');
  var tmp_str = text;

  // first make sure everything is numeric
  for (i = 0; i <= plain.length; i++) {
    num = numeric[i];
    name = numeric[i];
    utf = plain[i];

    tmp_str = tmp_str.split(num).join(utf).split(name).join(utf);
  }
  return tmp_str;
}

function get_html_translation_table (table, quote_style) {
    // http://kevin.vanzonneveld.net
    // +   original by: Philip Peterson
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: noname
    // +   bugfixed by: Alex
    // +   bugfixed by: Marco
    // +   bugfixed by: madipta
    // +   improved by: KELAN
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Frank Forte
    // +   bugfixed by: T.Wild
    // +      input by: Ratheous
    // %          note: It has been decided that we're not going to add global
    // %          note: dependencies to php.js, meaning the constants are not
    // %          note: real constants, but strings instead. Integers are also supported if someone
    // %          note: chooses to create the constants themselves.
    // *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
    // *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}
    var entities = {},
        hash_map = {},
        decimal = 0,
        symbol = '';
    var constMappingTable = {},
        constMappingQuoteStyle = {};
    var useTable = {},
        useQuoteStyle = {};

    // Translate arguments
    constMappingTable[0] = 'HTML_SPECIALCHARS';
    constMappingTable[1] = 'HTML_ENTITIES';
    constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
    constMappingQuoteStyle[2] = 'ENT_COMPAT';
    constMappingQuoteStyle[3] = 'ENT_QUOTES';

    useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
    useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT';

    if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
        throw new Error("Table: " + useTable + ' not supported');
        // return false;
    }

    entities['38'] = '&amp;';
    if (useTable === 'HTML_ENTITIES') {
        entities['160'] = '&nbsp;';
        entities['161'] = '&iexcl;';
        entities['162'] = '&cent;';
        entities['163'] = '&pound;';
        entities['164'] = '&curren;';
        entities['165'] = '&yen;';
        entities['166'] = '&brvbar;';
        entities['167'] = '&sect;';
        entities['168'] = '&uml;';
        entities['169'] = '&copy;';
        entities['170'] = '&ordf;';
        entities['171'] = '&laquo;';
        entities['172'] = '&not;';
        entities['173'] = '&shy;';
        entities['174'] = '&reg;';
        entities['175'] = '&macr;';
        entities['176'] = '&deg;';
        entities['177'] = '&plusmn;';
        entities['178'] = '&sup2;';
        entities['179'] = '&sup3;';
        entities['180'] = '&acute;';
        entities['181'] = '&micro;';
        entities['182'] = '&para;';
        entities['183'] = '&middot;';
        entities['184'] = '&cedil;';
        entities['185'] = '&sup1;';
        entities['186'] = '&ordm;';
        entities['187'] = '&raquo;';
        entities['188'] = '&frac14;';
        entities['189'] = '&frac12;';
        entities['190'] = '&frac34;';
        entities['191'] = '&iquest;';
        entities['192'] = '&Agrave;';
        entities['193'] = '&Aacute;';
        entities['194'] = '&Acirc;';
        entities['195'] = '&Atilde;';
        entities['196'] = '&Auml;';
        entities['197'] = '&Aring;';
        entities['198'] = '&AElig;';
        entities['199'] = '&Ccedil;';
        entities['200'] = '&Egrave;';
        entities['201'] = '&Eacute;';
        entities['202'] = '&Ecirc;';
        entities['203'] = '&Euml;';
        entities['204'] = '&Igrave;';
        entities['205'] = '&Iacute;';
        entities['206'] = '&Icirc;';
        entities['207'] = '&Iuml;';
        entities['208'] = '&ETH;';
        entities['209'] = '&Ntilde;';
        entities['210'] = '&Ograve;';
        entities['211'] = '&Oacute;';
        entities['212'] = '&Ocirc;';
        entities['213'] = '&Otilde;';
        entities['214'] = '&Ouml;';
        entities['215'] = '&times;';
        entities['216'] = '&Oslash;';
        entities['217'] = '&Ugrave;';
        entities['218'] = '&Uacute;';
        entities['219'] = '&Ucirc;';
        entities['220'] = '&Uuml;';
        entities['221'] = '&Yacute;';
        entities['222'] = '&THORN;';
        entities['223'] = '&szlig;';
        entities['224'] = '&agrave;';
        entities['225'] = '&aacute;';
        entities['226'] = '&acirc;';
        entities['227'] = '&atilde;';
        entities['228'] = '&auml;';
        entities['229'] = '&aring;';
        entities['230'] = '&aelig;';
        entities['231'] = '&ccedil;';
        entities['232'] = '&egrave;';
        entities['233'] = '&eacute;';
        entities['234'] = '&ecirc;';
        entities['235'] = '&euml;';
        entities['236'] = '&igrave;';
        entities['237'] = '&iacute;';
        entities['238'] = '&icirc;';
        entities['239'] = '&iuml;';
        entities['240'] = '&eth;';
        entities['241'] = '&ntilde;';
        entities['242'] = '&ograve;';
        entities['243'] = '&oacute;';
        entities['244'] = '&ocirc;';
        entities['245'] = '&otilde;';
        entities['246'] = '&ouml;';
        entities['247'] = '&divide;';
        entities['248'] = '&oslash;';
        entities['249'] = '&ugrave;';
        entities['250'] = '&uacute;';
        entities['251'] = '&ucirc;';
        entities['252'] = '&uuml;';
        entities['253'] = '&yacute;';
        entities['254'] = '&thorn;';
        entities['255'] = '&yuml;';
        entities['8212'] = '—';
    }

    if (useQuoteStyle !== 'ENT_NOQUOTES') {
        entities['34'] = '&quot;';
    }
    if (useQuoteStyle === 'ENT_QUOTES') {
        entities['39'] = '&#39;';
    }
    entities['60'] = '&lt;';
    entities['62'] = '&gt;';


    // ascii decimals to real symbols
    for (decimal in entities) {
        symbol = String.fromCharCode(decimal);
        hash_map[symbol] = entities[decimal];
    }

    delete(hash_map['&']);
    hash_map['&'] = '&amp;';

    return hash_map;
}

function html_entity_decode(string, quote_style) {
    // http://kevin.vanzonneveld.net
    // +   original by: john (http://www.jd-tech.net)
    // +      input by: ger
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: marc andreu
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +      input by: Ratheous
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Nick Kolosov (http://sammy.ru)
    // +   bugfixed by: Fox
    // -    depends on: get_html_translation_table
    // *     example 1: html_entity_decode('Kevin &amp; van Zonneveld');
    // *     returns 1: 'Kevin & van Zonneveld'
    // *     example 2: html_entity_decode('&amp;lt;');
    // *     returns 2: '&lt;'
    var hash_map = {},
        symbol = '',
        tmp_str = '',
        entity = '';
    tmp_str = string.toString();

    if (false === (hash_map = get_html_translation_table('HTML_ENTITIES', quote_style))) {
        return false;
    }

    for (symbol in hash_map) {
        entity = hash_map[symbol];
        tmp_str = tmp_str.split(entity).join(symbol);
    }
    tmp_str = tmp_str.split('&#039;').join("'");

    return tmp_str;
}
