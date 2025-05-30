/* eslint-disable no-console */
import { styleText } from "util";
import { logSuccess, logError, withTaskLog } from "../utils/log.ts";
import { 
  generateAesKey, 
  exportKeyToString, 
  importKeyFromString 
} from "../utils/crypto.ts";

/**
 * Generate and display encryption key in different formats
 */
async function generateAndDisplayKey() {
  try {
    // Generate a new AES key
    const key = await withTaskLog("Generating new AES key", async () => {
      return generateAesKey(256);
    });

    // Export the key to string format
    const keyString = await withTaskLog("Exporting key to string format", async () => {
      return exportKeyToString(key);
    });

    // Test importing the key back
    await withTaskLog("Verifying key can be imported correctly", async () => {
      const importedKey = await importKeyFromString(keyString);
      if (!importedKey) throw new Error("Failed to import key");
      return importedKey;
    });

    // Display results
    console.log(`\n${  styleText("cyan", "Encryption Key Information:")}`);
    console.log(styleText("green", "Base64 Key String (for ENCRYPTION_KEY env variable):"));
    console.log(keyString);
    
    // Display key details
    console.log(`\n${  styleText("yellow", "Key Details:")}`);
    console.log(Bun.inspect({
      type: key.type,
      algorithm: key.algorithm,
      extractable: key.extractable,
      usages: key.usages
    }, { colors: true }));

    // Display usage instructions
    console.log(`\n${  styleText("magenta", "Usage Instructions:")}`);
    console.log("Add this key to your environment variables:");
    console.log(styleText("cyan", `ENCRYPTION_KEY="${keyString}"`));
    
    logSuccess("Encryption key generated successfully");
  } catch (error) {
    logError("Failed to generate encryption key", error);
    process.exit(1);
  }
}

async function main() {
  await generateAndDisplayKey();
  process.exit(0);
}

main();
