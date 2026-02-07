export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Start the Express API server alongside Next.js
    const { spawn } = await import("child_process");
    const path = await import("path");

    const serverPath = path.join(process.cwd(), "server.js");

    console.log("[v0] Starting Express API server...");

    const child = spawn("node", [serverPath], {
      env: {
        ...process.env,
        PORT: "5000",
      },
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error("[v0] Failed to start Express server:", err);
    });

    child.on("exit", (code) => {
      console.log(`[v0] Express server exited with code ${code}`);
    });
  }
}
