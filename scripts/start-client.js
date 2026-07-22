const net = require("net");
const {spawn} = require("child_process");

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();

    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });

    // Probe the same dual-stack interface CRA uses so IPv6 listeners are
    // detected too (probing only 127.0.0.1 can incorrectly report it free).
    probe.listen(port);
  });

const start = async () => {
  const port = (await isPortAvailable(3000)) ? 3000 : 3001;
  console.log(`Starting website on http://localhost:${port}`);

  const child = spawn(process.execPath, [require.resolve("react-scripts/scripts/start")], {
    env: {...process.env, PORT: String(port)},
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });
};

start().catch((error) => {
  console.error("Unable to start the website:", error);
  process.exit(1);
});
