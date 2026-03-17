export const config = {
  matcher: '/api/hello',
};

export function middleware(context) {
  return context.redirect('/api/users/22', 302);
}
