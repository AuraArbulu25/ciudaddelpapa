# Ciudad del Papa

Citizen-initiatives platform for Chiclayo (ciudaddelpapa.com). Static site on Vercel, content edited with Pages CMS, emails sent with Resend. No dependencies to install.

## How it works

Everything below `content/` is edited in Pages CMS:

- `content/iniciativas/*.json` — one file per initiative ("Iniciativas" in the CMS).
- `content/temas/*.json` — one file per tema ("Temas"). Initiatives point to a tema, so renaming a tema updates every initiative.
- `content/datos.json` — the figures and charts about Chiclayo ("Cifras y gráficos"). Every figure carries its source and link; the build log warns if one is missing.
- `content/sitio.json` — all page texts ("Textos de la página"): headline, the two boxes, Para quién es, steps, criteria, Sobre el proyecto, FAQ, the proposal intro and the footer notice.

The rest:

- `src/` — the home page template (`index.html`), the initiative page template (`iniciativa.html`), shared styles (`estilos.css`) and script (`app.js`), the flag, and `uploads/` where photos added in the CMS are stored.
- `build.js` — on every deploy, fills the template with the content above and builds `public/`. Only public fields reach the page: the responsible's email and phone are never published. If something is missing or a tema doesn't exist, the build log in Vercel shows an "Aviso" line.
- `api/sumarme.js` — when someone joins an initiative, emails the initiative's responsible, copies the team, and sends a confirmation to the person.
- `api/proponer.js` — emails new proposals to the team.
- `.pages.yml` — the CMS form.

## Deploy

1. Create a **private** GitHub repository and push these files. Keep it private: the content files hold the responsibles' contact details.
2. In Vercel, import the repository. The settings come from `vercel.json`; nothing to change.
3. In Resend, create an account, add and verify the domain `ciudaddelpapa.com`, and create an API key.
4. In Vercel, under Project > Settings > Environment Variables, add the three variables from `.env.example`, then redeploy.
   - `RESEND_API_KEY`: the key from Resend.
   - `EMAIL_FROM`: the sender, on the verified domain.
   - `ADMIN_EMAIL`: the team inbox. It receives every proposal and a copy of every join request.
5. In Vercel, add the domain `ciudaddelpapa.com` to the project.
6. In Pages CMS (app.pagescms.org), sign in with GitHub and open the repository.

## Initiative pages

Each published initiative gets its own page at `/iniciativas/<file-name>/`, shareable on WhatsApp. In the CMS each initiative can have:
- **Enlaces:** buttons such as WhatsApp (just type the number; Peruvian 9-digit numbers get +51 automatically), a map, a website, social media, a document or a form. Only `https://` links are accepted.
- **Meta y avance:** a goal with a progress bar ("Meta: 500 árboles plantados · Llevamos 120").
- **Avances:** dated notes, newest first.
- **Próxima actividad:** date, time, place and details.
- **Fotos:** uploaded through the CMS into `src/uploads/`.
- **Mapa:** the embed link of a uMap or Google My Maps map, shown inside the page.

## Day to day

- **Add or edit an initiative:** in Pages CMS, under "Iniciativas". Saving commits to GitHub and Vercel redeploys in about a minute.
- **Hide an initiative:** switch off "Publicada en el sitio".
- **Examples:** initiatives marked "Es un ejemplo" show an "Ejemplo" label and cannot be joined. Delete them or switch them off before launch.
- **Join requests:** go to the "Correo del responsable" of the initiative. If that field is empty they go to `ADMIN_EMAIL`.
- **Page texts:** "Textos de la página" in the CMS. In "Sobre el proyecto", leave a blank line between paragraphs. List items (steps, FAQ, criteria) can be added, removed and reordered.
- **Temas:** "Temas" in the CMS. "Orden en la lista" sets the order in the filter. Before deleting a tema, move its initiatives to another one, or they disappear from the tema filter.
- **Flag:** `src/bandera-chiclayo.svg` is the light-blue field with a placeholder shield. Replace the file with the official artwork, keeping the same name.

## Run locally

```
node build.js
npx vercel dev
```

`node build.js` alone is enough to check the page: open `public/index.html`. The forms need `vercel dev` and the environment variables.
