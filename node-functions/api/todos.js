// In-memory store (resets on cold start — use a database for persistence)
const todos = [
  { id: 1, text: 'Learn EdgeOne Pages', done: true },
  { id: 2, text: 'Build a Node Function', done: false },
  { id: 3, text: 'Deploy to production', done: false },
];
let nextId = 4;

// GET /api/todos — list all todos
export function onRequestGet() {
  return Response.json({ todos });
}

// POST /api/todos — create a new todo
export async function onRequestPost(context) {
  const body = await context.request.json();

  if (!body.text || typeof body.text !== 'string') {
    return Response.json({ error: 'Missing "text" field' }, { status: 400 });
  }

  const todo = { id: nextId++, text: body.text.trim(), done: false };
  todos.push(todo);

  return Response.json({ todo }, { status: 201 });
}

// DELETE /api/todos — delete a todo by id (passed as query param)
export function onRequestDelete(context) {
  const url = new URL(context.request.url);
  const id = parseInt(url.searchParams.get('id'), 10);

  if (isNaN(id)) {
    return Response.json({ error: 'Missing or invalid "id" query param' }, { status: 400 });
  }

  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return Response.json({ error: 'Todo not found' }, { status: 404 });
  }

  const [removed] = todos.splice(index, 1);
  return Response.json({ deleted: removed });
}
