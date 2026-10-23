# PsyCourse Route Map

These are browser **page routes**, not backend API endpoints.

## Public and authentication
- `/` — landing page
- `/register` — registration prototype
- `/login` — login prototype
- `/forgot-password` — password recovery request
- `/verify-otp?mode=register` — registration OTP prototype
- `/reset-password` — reset password prototype
- `/welcome` — registration success
- `/packages` — pricing plans
- `/privacy` — bilingual privacy policy draft
- `/terms` — bilingual terms of service draft

## Student
- `/dashboard` — student dashboard; profile link opens `/settings`
- `/courses/logika`
- `/courses/numerik`
- `/courses/verbal`
- `/courses/spasial`
- `/courses/memori`
- `/tests/logika-test-1` — untimed sample test
- `/tests/logika-test-2` — timed browser-side demo test
- `/tests/logika-practice` — practice demo
- `/results/[id]` — demo result
- `/history` — test history placeholder
- `/settings` — account settings
- `/checkout?package=premium` — demo checkout (`free`, `single`, `premium`)
- `/payment-history` — payment history placeholder

## Admin
- `/admin` — admin login prototype
- `/admin/dashboard` — admin overview
- `/admin/courses` — course management UI
- `/admin/tests` — test management UI
- `/admin/questions` — question management UI
- `/admin/access` — access-management UI
- `/admin/policies` — policy-management UI

## Backend API status
There are currently no implemented `/api/...` route handlers in this frontend starter. Proposed API contracts are documented in `README.md`, Section 6. The `/admin/...` routes above are frontend pages only and do not provide security or database CRUD by themselves.
