/** Returns headers that bypass AuthMiddleware and set user directly in controllers. */
export function customerHeaders(userId: string, email = 'test@example.com') {
  return {
    'x-user-id': userId,
    'x-roles': 'CUSTOMER',
    'x-email': email,
  };
}

export function adminHeaders(userId: string, roles = 'SUPER_ADMIN', email = 'admin@example.com') {
  return {
    'x-user-id': userId,
    'x-roles': roles,
    'x-email': email,
  };
}

export function internalHeaders() {
  return { 'x-internal-token': 'dev-internal' };
}
