export const log = (message: string, type?: string) => {
  console.log(
    `[${new Date().toLocaleString()}] [${type || "Info"}] ${message}`
  );
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
