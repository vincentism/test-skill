export function onRequestGet(context) {
  const userId = context.params.id;

  return new Response(
    JSON.stringify({
      userId,
      message: `User ${userId} found`,
      timestamp: Date.now(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
