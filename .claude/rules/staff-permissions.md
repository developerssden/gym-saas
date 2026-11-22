# New features and routes: wire them into staff permissions

Gym owners can give staff logins with per-page permissions (`lib/staff-permissions.ts`). Any new page, API route or action that works on a gym's data must be added to that system. Otherwise staff either can't use it or, worse, can use it without the owner's permission.

When you add a gym-owner feature, page or route, do all of the following in the same branch:

1. **Permission catalogue** (`lib/staff-permissions.ts`)
   - New page: add an entry to `PERMISSION_PAGES` with its `id`, `label`, `routes` and at least a `<id>.view` action, plus one action per thing staff could do there (`create`, `edit`, `delete`, or a specific one like `members.import`).
   - New action on an existing page: add a key to that page's `actions`.
   - Decide whether the new key belongs in `DEFAULT_STAFF_PERMISSIONS`. Leave out anything sensitive by default (revenue, profit, deletes, money settings).
   - If the route doesn't follow the `/x`, `/x/manage?action=view|edit|create` pattern, update `permissionsForPath` and add a test case for it.
   - The permission page (`components/staff/PermissionMatrix.tsx`) reads `PERMISSION_PAGES`, so new checkboxes appear automatically.

2. **Page routing** (`proxy.ts`): add the route to `ROUTE_GATES` with `STAFF` in its roles. The proxy then checks the staff member's permission through `permissionsForPath`.

3. **Sidebar** (`constants/data.ts`): add `STAFF` to the nav item's `permissions`. The sidebar hides it for staff without `<id>.view`.

4. **API routes** (`pages/api/...`): use `requireAccess(req, res, { permission: "<key>" })` from `lib/access.ts`, never a bare session or role check.
   - Scope queries by `access.ownerId`, never `session.user.id`, because a staff member's id isn't the owner's.
   - Use `ownedGymWhere(access)` / `ownsGym(access, gym)` so staff stay inside their one gym, even if the client sends another `gym_id`.
   - Record who did it with `access.userId` (for example `recorded_by_id`).

5. **Buttons and actions in the UI**: gate them with `usePermissions().can("<key>")` so staff don't see buttons that will fail.

6. **Tests**: `npm test` runs `tests/staff-permissions.test.ts`, which fails if a dashboard page or a nav item isn't covered by a permission page or listed as owner-only.

## Owner-only or not gym data

Some routes must stay closed to staff: staff management, billing and plan subscription, gym and location setup, and anything SUPER_ADMIN-only.
- Leave `STAFF` out of the proxy gate and the nav item.
- Call `requireAccess` without a `permission`, which denies staff.
- Add the route to `OWNER_ONLY_ROUTES` (or `ALL_SIGNED_IN_ROUTES` for pages like profile and notifications) in `tests/staff-permissions.test.ts`, so the choice is explicit.

If you're unsure whether staff should get a new feature, ask the user rather than guessing.
