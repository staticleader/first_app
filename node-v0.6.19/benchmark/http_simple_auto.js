//
// Usage:
//   node benchmark/http_simple_auto.js <args> <target>
//
// Where:
//   <args>   Arguments to pass to `ab`.
//   <target> Target to benchmark, e.g. `bytes/1024` or `buffer/8192`.
//

var path = require("path");
var http = require("http");
var spawn = require("child_process").spawn;

var port = parseInt(process.env.PORT || 8000);

var fixed = ""
for (var i = 0; i < 20*1024; i++) {
  fixed += "C";
}

var stored = {};
var storedBuffer = {};

var server = http.createServer(function (req, res) {
  var commands = req.url.split("/");
  var command = commands[1];
  var body = "";
  var arg = commands[2];
  var n_chunks = parseInt(commands[3], 10);
  var status = 200;

  if (command == "bytes") {
    var n = parseInt(arg, 10)
    if (n <= 0)
      throw "bytes called with n <= 0"
    if (stored[n] === undefined) {
      stored[n] = "";
      for (var i = 0; i < n; i++) {
        stored[n] += "C"
      }
    }
    body = stored[n];

  } else if (command == "buffer") {
    var n = parseInt(arg, 10)
    if (n <= 0) throw new Error("bytes called with n <= 0");
    if (storedBuffer[n] === undefined) {
      storedBuffer[n] = new Buffer(n);
      for (var i = 0; i < n; i++) {
        storedBuffer[n][i] = "C".charCodeAt(0);
      }
    }
    body = storedBuffer[n];

  } else if (command == "quit") {
    res.connection.server.close();
    body = "quitting";

  } else if (command == "fixed") {
    body = fixed;

  } else if (command == "echo") {
    res.writeHead(200, { "Content-Type": "text/plain",
                         "Transfer-Encoding": "chunked" });
    req.pipe(res);
    return;

  } else {
    status = 404;
    body = "not found\n";
  }

  // example: http://localhost:port/bytes/512/4
  // sends a 512 byte body in 4 chunks of 128 bytes
  if (n_chunks > 0) {
    res.writeHead(status, { "Content-Type": "text/plain",
                            "Transfer-Encoding": "chunked" });
    // send body in chunks
    var len = body.length;
    var step = ~~(len / n_chunks) || len;

    for (var i = 0; i < len; i += step) {
      res.write(body.slice(i, i + step));
    }

    res.end();
  } else {
    var content_length = body.length.toString();

    res.writeHead(status, { "Content-Type": "text/plain",
                            "Content-Length": content_length });
    res.end(body);
  }

});

server.listen(port, function () {
  var url = 'http://127.0.0.1:' + port + '/';

  var n = process.argv.length - 1;
  process.argv[n] = url + process.argv[n];

  var cp = spawn('ab', process.argv.slice(2));
  cp.stdout.pipe(process.stdout);
  cp.stderr.pipe(process.stderr);
  cp.on('exit', function() {
    server.close();
  });
});
