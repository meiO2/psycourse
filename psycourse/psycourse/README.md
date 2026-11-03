This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Admin question import

Sign in with an administrator account, then open `/admin/questions` to view questions from PostgreSQL or choose **Impor bank soal**. The page reads up to 500 questions through authenticated `GET /api/admin/questions`. The CSV importer writes questions to the selected active category/test in PostgreSQL. It accepts up to 500 questions per file (maximum 1 MB), rejects duplicate question text for the target test, and defaults an omitted status to `DRAFT` so imported content is not available to students before review.

Download the CSV template on the import page. Required columns are `question`, `choices`, `answer`, and `explanation`; `status` is optional. Separate answer choices with `|`, and set `answer` to the correct choice number starting at 1. Supported statuses are `Draft`, `Aktif`/`Ready`, and `Nonaktif`; an omitted status defaults to `Draft`. `GET /api/admin/questions/import` lists active import targets and `POST /api/admin/questions/import` accepts multipart form data with `testId` and `file`; both endpoints require an administrator session.

The `/admin/tests` page reads course test versions from PostgreSQL. `GET /api/admin/tests` lists versions and question counts; `POST /api/admin/tests` creates a missing version for a course (the database permits one each of Test 1, Test 2, and Practice); `PATCH /api/admin/tests/[id]` updates status and, for Test 2 only, the timer. `DELETE /api/admin/tests/[id]` deletes a version and its attached questions only if it has no attempt history; versions with history must be marked inactive instead. New versions default to Draft.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
