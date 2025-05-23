
import { customAlphabet } from 'nanoid'

/**
 * Utility function: Execute a function at intervals while another asynchronous function is running.
 * @param intervalFunction - The function to be executed at intervals.
 * @param intervalTime - The time interval for the interval function (in milliseconds).
 * @param onComplete - Callback function to be executed when the asynchronous function completes.
 *                     Receives the return value of the asynchronous function.
 */
export function runWithInterval<T>(
  asyncFunction: () => Promise<T>,
  intervalFunction: () => void,
  intervalTime: number,
  onComplete?: (result: T) => void,
  onError?: (error: unknown) => void,
): void {
  let intervalId: NodeJS.Timeout | number;

  // Start executing the interval function at the specified interval
  function startInterval(): void {
    intervalId = setInterval(intervalFunction, intervalTime);
  }

  // Stop the interval execution
  function stopInterval(): void {
    clearInterval(intervalId);
  }

  // Start the interval task
  startInterval();

  // Execute the asynchronous function
  asyncFunction()
    .then((result: T) => {
      // Stop the interval task when the asynchronous function completes
      stopInterval();

      // If a callback function is provided, execute it with the result
      if (onComplete) {
        onComplete(result);
      }
    })
    .catch((error: unknown) => {
      // If the asynchronous function throws an error, stop the interval task and handle the error
      stopInterval();
      console.error("Asynchronous function execution error:", error);
      if (onError) {
        onError(error);
      }
    });
}


export function myNanoId(size: number = 13) {
  return customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', size);
}
