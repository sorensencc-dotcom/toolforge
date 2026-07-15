import { Router, Request, Response } from "express";
import { executePipeline } from "../handlers/pipeline";

const router = Router();

router.post("/person/:pid", async (req: Request, res: Response) => {
  try {
    const result = await executePipeline({
      adapter: "familysearch",
      key: req.params.pid,
      context: req.body || {},
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
