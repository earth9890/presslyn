/**
 * Image Size Registry
 *
 * WordPress equivalent: image sizes registered via add_image_size().
 * Defines thumbnail, medium, large, and custom sizes.
 */

export interface ImageSizeDefinition {
  name: string;
  width: number;
  height: number;
  crop: boolean;
}

const registry: Map<string, ImageSizeDefinition> = new Map();

/** Register built-in WordPress-matching image sizes */
function registerBuiltins() {
  registerImageSize("thumbnail", 150, 150, true);
  registerImageSize("medium", 300, 300, false);
  registerImageSize("medium_large", 768, 0, false);
  registerImageSize("large", 1024, 1024, false);
}

export function registerImageSize(
  name: string,
  width: number,
  height: number,
  crop: boolean = false
): void {
  registry.set(name, { name, width, height, crop });
}

export function getImageSize(name: string): ImageSizeDefinition | undefined {
  return registry.get(name);
}

export function getAllImageSizes(): ImageSizeDefinition[] {
  return Array.from(registry.values());
}

// Initialize built-in sizes
registerBuiltins();
