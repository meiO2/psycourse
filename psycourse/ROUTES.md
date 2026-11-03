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
- `/admin/questions/import` — import a question bank CSV into an active category/test
- `/admin/access` — access-management UI
- `/admin/policies` — policy-management UI

## Backend API status
Course management uses authenticated `GET /api/admin/courses` and `PATCH`/`DELETE /api/admin/courses/[id]`. A course can only be deleted if none of its tests have attempts or purchased entitlements; deleting it also deletes its tests and attached questions. The question bank page reads up to 500 questions from authenticated `GET /api/admin/questions`. The importer uses authenticated `GET` and `POST /api/admin/questions/import` routes to list active import targets and create validated questions in the database. Test version management uses authenticated `GET` and `POST /api/admin/tests` plus `PATCH` and `DELETE /api/admin/tests/[id]` to list, create missing course/test versions, update their status and Test 2 timer, and delete a version if it has no attempt history. Deleting a test also deletes its attached questions. Policy management uses authenticated `GET` and `POST /api/admin/policies` plus `PATCH` and `DELETE /api/admin/policies/[id]` to manage bilingual policy versions. Only the currently published (`TERBIT`) version is returned by public `GET /api/legal/privacy` and `GET /api/legal/terms`; registration records consent to the published privacy-policy version. Other `/admin/...` routes remain frontend prototypes and do not provide database CRUD by themselves.
