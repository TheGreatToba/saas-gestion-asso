export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  confirmEmail: "/confirm-email",
  acceptInvite: "/accept-invite",
  dashboard: "/dashboard",
  intervention: "/intervention",
  families: "/families",
  familyDetail: "/families/:id",
  needs: "/needs",
  aids: "/aids",
  stock: "/stock",
  reports: "/reports",
  users: "/users",
} as const;

export type AppRouteKey = keyof typeof ROUTES;
export type AppRoutePath = (typeof ROUTES)[AppRouteKey];

export function familyDetailRoute(id: string | number) {
  return `/families/${id}`;
}

export function aidsAddForNeedRoute(params: { familyId: string | number; type: string }) {
  const search = new URLSearchParams({
    action: "add",
    familyId: String(params.familyId),
    type: params.type,
  });
  return `${ROUTES.aids}?${search.toString()}`;
}

