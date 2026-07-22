// Minimal multipart/form-data parser — single file field, small uploads (resumes)
/**
 * Read raw request body and extract the first file part.
 * Returns { filename, fileBytes } or null when no file part found.
 */
export async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!boundaryMatch) return null;
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const boundaryBuf = Buffer.from(boundary);
  let start = body.indexOf(boundaryBuf);
  while (start !== -1) {
    const partStart = start + boundaryBuf.length + 2; // skip \r\n
    const next = body.indexOf(boundaryBuf, partStart);
    if (next === -1) break;

    const part = body.subarray(partStart, next - 2); // trim trailing \r\n
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString("utf8");
      const filenameMatch = headerText.match(/filename="([^"]*)"/);
      if (filenameMatch && filenameMatch[1]) {
        return {
          filename: filenameMatch[1],
          fileBytes: part.subarray(headerEnd + 4),
        };
      }
    }
    start = next;
  }
  return null;
}
