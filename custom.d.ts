import { Models } from "./src/database";
declare global {
  namespace Express {
    interface Request {
      models: Models;
    }
  }
}
