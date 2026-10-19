// Runs in the browser: turns a phone photo into a compact image before upload.
//  - Decoding it proves it is a real image (anything else is rejected).
//  - It is redrawn on a canvas, which strips hidden metadata such as the GPS
//    location where the photo was taken.
//  - It is resized (longest side 1600px by default) and saved as WebP, or JPEG
//    on older browsers without WebP support. A ~480px thumbnail is made too.

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public reason: "notImage" | "tooLarge") {
    super(reason);
  }
}

export type PreparedImage = {
  main: Blob;
  thumb: Blob;
  width: number;
  height: number;
  extension: "webp" | "jpg";
};

function fit(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("notImage");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new ImageError("notImage");
  return jpeg;
}

export async function prepareImage(file: File, maxDimension = 1600): Promise<PreparedImage> {
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("tooLarge");
  if (file.type && !file.type.startsWith("image/")) throw new ImageError("notImage");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("notImage");
  }

  try {
    const main = fit(bitmap.width, bitmap.height, maxDimension);
    const thumb = fit(bitmap.width, bitmap.height, 480);
    const mainBlob = await encode(bitmap, main.width, main.height, 0.82);
    const thumbBlob = await encode(bitmap, thumb.width, thumb.height, 0.72);
    return {
      main: mainBlob,
      thumb: thumbBlob,
      width: main.width,
      height: main.height,
      extension: mainBlob.type === "image/webp" ? "webp" : "jpg",
    };
  } finally {
    bitmap.close();
  }
}
