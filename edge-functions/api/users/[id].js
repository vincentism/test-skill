export function onRequestGet(context) {
  const userId = context.params.id;

  return Response.json({
    userId,
    message: `User ${userId} found`,
    timestamp: Date.now(),
  });
}
