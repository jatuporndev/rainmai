// Keep cancellation and timeouts compatible with Safari versions that do not
// implement AbortSignal.any()/timeout(). Cover body reading as well as headers.
export async function requestData<T>(url: string, read: (response: Response) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 18000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`The data provider returned ${response.status}. Please try again shortly.`);
    return await read(response);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
