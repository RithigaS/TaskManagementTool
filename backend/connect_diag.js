const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error("MONGO_URL not set in .env");
  process.exit(1);
}

async function tryConnect(name, opts) {
  console.log("\n--- TRY:", name, "---");
  const client = new MongoClient(
    MONGO_URL,
    Object.assign({ serverSelectionTimeoutMS: 10000 }, opts)
  );
  try {
    await client.connect();
    const admin = client.db().admin();
    const ping = await admin.ping();
    console.log(name, "connected; ping response:", ping);
  } catch (err) {
    console.error(name, "FAILED");
    console.error(err && err.stack ? err.stack : err);
  } finally {
    try {
      await client.close();
    } catch (e) {}
  }
}

(async () => {
  // 1. Default
  await tryConnect("default", {});

  // 2. tlsAllowInvalidCertificates / tlsInsecure (diagnostic)
  // 2. tlsAllowInvalidCertificates (diagnostic)
  await tryConnect("tls_allow_invalid_cert", {
    tlsAllowInvalidCertificates: true,
  });

  // 3. tlsInsecure (diagnostic)
  await tryConnect("tls_insecure_only", { tlsInsecure: true });

  // 4. NODE_TLS_REJECT_UNAUTHORIZED=0 (global skip cert verification)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  await tryConnect("node_tls_reject_unauthorized_0", {});

  // 5. directConnection true + tlsAllowInvalidCertificates (diagnostic)
  await tryConnect("direct_allow_invalid", {
    directConnection: true,
    tlsAllowInvalidCertificates: true,
  });

  // 6. short timeout to show immediate errors
  await tryConnect("short_timeout", { serverSelectionTimeoutMS: 3000 });

  // 3. directConnection true (connect to single host from SRV) + insecure

  // 4. short timeout to show immediate errors

  console.log("\nDiagnostics finished");
})();
