export const log = (message: string, type?: string) => {
  console.log(
    `[${new Date().toLocaleString()}] [${type || "Info"}] ${message}`
  );
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const checkEnvForFields = (required: string[], service: string) => {
  if (required.some((field) => !process.env[field])) {
    log(
      `Missing required environment variables for ${service}, please define: \n ` +
        required.join("\n "),
      "error"
    );
    return false;
  }
  return true;
};

export const binarySearchForLowest = <
  T extends Record<string, string | number | bigint>
>(
  array: T[],
  key: keyof T & string,
  startIdx: number,
  endIdx: number,
  searchVal: string
): number => {
  // Ensure that `searchVal` is a numeric string
  if (isNaN(Number(searchVal))) {
    throw new Error("searchVal is not a number");
  }

  // Boundary checks to ensure valid indices
  if (startIdx < 0 || endIdx >= array.length || startIdx > endIdx) {
    return -1;
  }

  // Base case: when the search range has only one element left
  if (startIdx === endIdx) {
    return BigInt(array[startIdx][key]) <= BigInt(searchVal) ? startIdx : -1;
  }

  // Calculate middle index
  const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);

  // If the search value is less than the middle element, search the left half
  if (BigInt(searchVal) < BigInt(array[midIdx][key])) {
    return binarySearchForLowest(array, key, startIdx, midIdx, searchVal);
  }

  // Otherwise, search the right half
  const ret = binarySearchForLowest(array, key, midIdx + 1, endIdx, searchVal);
  return ret === -1 ? midIdx : ret;
};
