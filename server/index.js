import "dotenv/config";
import { createApp } from "./app.js";
const { app, db } = createApp();
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.info(
      "InterviewAce API listening on port " + (process.env.PORT || 3001),
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
