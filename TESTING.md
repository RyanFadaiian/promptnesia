Run these commands from the project root.

Frontend tests (Vitest and React Testing Library):

```powershell
npm.cmd --prefix frontend test
```

Use `npm.cmd --prefix frontend run test:watch` to rerun tests when files change.
Tests are in `frontend/tests` and mock network requests; no running backend is needed.

Backend tests (Python unittest):

```powershell
backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -t backend -v
```

Tests are in `backend/tests`. Keep the existing backend environment configured;
image generation and rewrite requests are mocked, so tests do not incur API charges.

Frontend build and lint checks:

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```
