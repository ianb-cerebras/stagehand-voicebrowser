import { ObserveResult, Page } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import fs from "fs/promises";
import { z } from "zod";

export function announce(message: string, title?: string) {
  console.log(
    boxen(message, {
      padding: 1,
      margin: 3,
      title: title || "Stagehand",
    }),
  );
}

/**
 * Get an environment variable and throw an error if it's not found
 * @param name - The name of the environment variable
 * @returns The value of the environment variable
 */
export function getEnvVar(name: string, required = true): string | undefined {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`${name} not found in environment variables`);
  }
  return value;
}

/**
 * Validate a Zod schema against some data
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Whether the data is valid against the schema
 */
export function validateZodSchema(schema: z.ZodTypeAny, data: unknown) {
  try {
    schema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export async function drawObserveOverlay(page: Page, results: ObserveResult[]) {
  // Convert single xpath to array for consistent handling
  const xpathList = results.map((result) => result.selector);

  // Filter out empty xpaths
  const validXpaths = xpathList.filter((xpath) => xpath !== "xpath=");

  await page.evaluate((selectors) => {
    selectors.forEach((selector) => {
      let element;
      if (selector.startsWith("xpath=")) {
        const xpath = selector.substring(6);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue;
      } else {
        element = document.querySelector(selector);
      }

      if (element instanceof HTMLElement) {
        const overlay = document.createElement("div");
        overlay.setAttribute("stagehandObserve", "true");
        const rect = element.getBoundingClientRect();
        overlay.style.position = "absolute";
        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";
        overlay.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "10000";
        document.body.appendChild(overlay);
      }
    });
  }, validXpaths);
}

export async function clearOverlays(page: Page) {
  // remove existing stagehandObserve attributes
  await page.evaluate(() => {
    const elements = document.querySelectorAll('[stagehandObserve="true"]');
    elements.forEach((el) => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    });
  });
}

export async function simpleCache(
  instruction: string,
  actionToCache: ObserveResult,
) {
  // Save action to cache.json
  try {
    // Read existing cache if it exists
    let cache: Record<string, ObserveResult> = {};
    try {
      const existingCache = await fs.readFile("cache.json", "utf-8");
      cache = JSON.parse(existingCache);
    } catch (error) {
      // File doesn't exist yet, use empty cache
    }

    // Add new action to cache
    cache[instruction] = actionToCache;

    // Write updated cache to file
    await fs.writeFile("cache.json", JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error(chalk.red("Failed to save to cache:"), error);
  }
}

export async function readCache(
  instruction: string,
): Promise<ObserveResult | null> {
  try {
    const existingCache = await fs.readFile("cache.json", "utf-8");
    const cache: Record<string, ObserveResult> = JSON.parse(existingCache);
    return cache[instruction] || null;
  } catch (error) {
    return null;
  }
}

/**
 * This function is used to act with a cacheable action.
 * It will first try to get the action from the cache.
 * If not in cache, it will observe the page and cache the result.
 * Then it will execute the action.
 * @param instruction - The instruction to act with.
 */
export async function actWithCache(
  page: Page,
  instruction: string,
): Promise<void> {
  // Try to get action from cache first
  const cachedAction = await readCache(instruction);
  if (cachedAction) {
    console.log(chalk.blue("Using cached action for:"), instruction);
    await page.act(cachedAction);
    return;
  }

  // If not in cache, observe the page and cache the result
  const results = await page.observe(instruction);
  console.log(chalk.blue("Got results:"), results);

  // Cache the playwright action
  const actionToCache = results[0];
  console.log(chalk.blue("Taking cacheable action:"), actionToCache);
  await simpleCache(instruction, actionToCache);
  // OPTIONAL: Draw an overlay over the relevant xpaths
  await drawObserveOverlay(page, results);
  await page.waitForTimeout(1000); // Can delete this line, just a pause to see the overlay
  await clearOverlays(page);

  // Execute the action
  await page.act(actionToCache);
}

/**
 * Temporarily prunes the DOM to only the visible elements and stores the removed
 * nodes on the window object so they can be restored later.
 */
export async function pruneDomToVisibleAndStore(page: Page) {
  await page.evaluate(() => {
    const removed: Array<{ parent: Node; element: Node; nextSibling: Node | null }> = [];

    const all = Array.from(document.body.querySelectorAll('*')) as HTMLElement[];

    for (const el of all) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        parseFloat(style.opacity) !== 0;

      if (!isVisible) {
        removed.push({ parent: el.parentNode!, element: el, nextSibling: el.nextSibling });
        el.parentNode!.removeChild(el);
      }
    }

    // @ts-ignore - attach to window for later restoration
    window.__stagehandRemoved = removed;
  });
}

/**
 * Restores the DOM that was pruned by {@link pruneDomToVisibleAndStore}.
 */
export async function restorePrunedDom(page: Page) {
  await page.evaluate(() => {
    // @ts-ignore
    const removed: Array<{ parent: Node; element: Node; nextSibling: Node | null }> = window.__stagehandRemoved || [];

    for (const { parent, element, nextSibling } of removed) {
      if (nextSibling && nextSibling.parentNode === parent) {
        parent.insertBefore(element, nextSibling);
      } else {
        parent.appendChild(element);
      }
    }

    // @ts-ignore
    window.__stagehandRemoved = [];
  });
}
