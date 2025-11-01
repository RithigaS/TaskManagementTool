const tls = require("tls");
const host = "ac-bp0bqwy-shard-00-00.nfaulzs.mongodb.net";
const port = 27017;
console.log("Probing TLS to", host + ":" + port);

const socket = tls.connect(
  { host, port, servername: host, rejectUnauthorized: false },
  () => {
    console.log("connected, cipher:", socket.getCipher());
    console.log(
      "authorized:",
      socket.authorized,
      "authorizationError:",
      socket.authorizationError
    );
    socket.end();
  }
);

socket.on("error", (err) => {
  console.error("TLS error:", err && err.stack ? err.stack : err);
});

socket.on("close", () => {
  console.log("socket closed");
});
