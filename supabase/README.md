# Qahwa — Supabase setup

Do these once, in order, before running the app.

## 1. Apply the schema
Open the **SQL Editor** in your Supabase project and run the full contents of
[`schema.sql`](./schema.sql). It is idempotent — safe to re-run.

This creates the 8 tables, the balance triggers, the `handle_new_user()`
auth trigger (auto-creates a `creators` row on signup), and all RLS policies.

## 2. Create storage buckets
Dashboard → **Storage** → New bucket:

| Bucket        | Public? |
|---------------|---------|
| `avatars`     | ✅ public |
| `selfies`     | 🔒 private |
| `voice-notes` | 🔒 private |

(The selfie review in /admin and the voice-note forwarding use signed URLs,
so those two must stay private.)

## 3. Create your god-admin account
1. Sign up a normal account through the app (`/signup`) **or** create a user
   in Dashboard → Authentication → Users.
2. Promote it to admin by running this in the SQL Editor (replace the email):

```sql
insert into public.admin_users (id, email)
select id, email from auth.users where email = 'you@example.com'
on conflict (id) do nothing;
```

Now `/admin/login` works for that account.

> Note: the signup form sets `is_creator: true`, so an account created via
> `/signup` will also have a `creators` row. If you want a pure admin, create
> the user in the Auth dashboard (no `is_creator` flag) and only insert into
> `admin_users`.

## 4. (Optional) Email confirmation
For the smoothest local flow, disable email confirmation in
Dashboard → Authentication → Providers → Email (turn off "Confirm email").
With it on, signup sends a confirmation link that returns to `/auth/callback`.
