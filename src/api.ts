import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { Models } from "./database";
import * as Routers from "./routes";

export const createApiServer = (models: Models) => {
  const app = express();

  const PORT = process.env.API_PORT || 3000;
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    req.models = models;

    next();
  });

  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
      error: "Too many requests, please try again later.",
    },
  });

  if (process.env.USE_RATE_LIMIT === "true") {
    app.use(limiter);
  }

  //Define routers
  app.use("/block", Routers.BlockRouter);
  app.use("/transaction", Routers.TransactionRouter);
  app.use("/address", Routers.AddressRouter);

  app.get("/", (request: Request, response: Response) => {
    response.status(200).send("Hello World");
  });

  app.listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  });
};
