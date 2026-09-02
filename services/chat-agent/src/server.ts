import express from "express";
import pipelineRouter from "./routes/pipeline";

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use("/pipeline", pipelineRouter);
  return app;
}

export function startServer(port = Number(process.env.PORT) || 8000) {
  const app = createServer();
  return app.listen(port, () => {
    console.log(`chat-agent listening on ${port}`);
  });
}
