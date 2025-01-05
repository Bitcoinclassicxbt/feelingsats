import { Models } from "./src/database";
import { IGlobal } from "./src/api";
declare global {
  namespace Express {
    interface Request {
      models: Models;
      global: IGlobal;
    }
  }
}
