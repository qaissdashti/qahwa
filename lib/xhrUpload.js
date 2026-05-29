// Wrapper around XMLHttpRequest for multipart file uploads. Used instead
// of fetch() because fetch doesn't expose upload progress events — we
// need them for the avatar / selfie upload percentages.
//
//   const json = await xhrUpload('/api/creator/avatar', fd, (pct) => …);
export function xhrUpload(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      let body;
      try { body = JSON.parse(xhr.responseText || '{}'); } catch { body = {}; }
      if (ok) return resolve(body);
      // Preserve any details the route surfaced so the caller can render
      // them alongside the friendly message (same shape as postJson).
      const err = new Error(body.error || `Upload failed (${xhr.status})`);
      err.status = xhr.status;
      err.details = body.details || null;
      reject(err);
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}
